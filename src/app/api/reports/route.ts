import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function movementDelta(type: string, quantity: number) {
  return type === "salida" ? -quantity : quantity;
}

function monthLabel(d: Date) {
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ProductAgg = {
  productId: string;
  productName: string;
  current: number;
  afterStart: number;
  afterEnd: number;
  entradas: number;
  salidas: number;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    let dateFrom = searchParams.get("dateFrom");
    let dateTo = searchParams.get("dateTo");

    const selectedMonth = month ? parseMonth(month) : null;

    if (selectedMonth && !dateFrom && !dateTo) {
      const y = selectedMonth.getFullYear();
      const m = String(selectedMonth.getMonth() + 1).padStart(2, "0");
      const lastDay = endOfMonth(selectedMonth).getDate();
      dateFrom = `${y}-${m}-01`;
      dateTo = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    }

    const where: Record<string, unknown> = {};

    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (type) where.type = type;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = startOfDay(parseLocalDate(dateFrom));
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = endOfDay(parseLocalDate(dateTo));
      }
    }

    const stockScope: { productId?: string; warehouseId?: string } = {};
    if (productId) stockScope.productId = productId;
    if (warehouseId) stockScope.warehouseId = warehouseId;

    const [movements, stocks, allMovements] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: {
          product: true,
          warehouse: true,
          technician: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      selectedMonth
        ? prisma.stock.findMany({
            where: stockScope,
            select: {
              productId: true,
              quantity: true,
              product: { select: { name: true } },
            },
          })
        : Promise.resolve(
            [] as { productId: string; quantity: number; product: { name: string } }[]
          ),
      selectedMonth
        ? prisma.movement.findMany({
            where: stockScope,
            select: {
              productId: true,
              type: true,
              quantity: true,
              createdAt: true,
              product: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve(
            [] as {
              productId: string;
              type: string;
              quantity: number;
              createdAt: Date;
              product: { name: string };
            }[]
          ),
    ]);

    const summary = movements.reduce(
      (acc, m) => {
        if (m.type === "entrada" || m.type === "ajuste") {
          acc.totalEntradas += m.quantity;
        } else {
          acc.totalSalidas += m.quantity;
        }
        return acc;
      },
      { totalEntradas: 0, totalSalidas: 0 }
    );

    let monthStock: {
      month: string;
      label: string;
      stockInicial: number;
      entradas: number;
      salidas: number;
      stockFinal: number;
      items: {
        productId: string;
        productName: string;
        stockInicial: number;
        entradas: number;
        salidas: number;
        stockFinal: number;
      }[];
    } | null = null;

    if (selectedMonth) {
      const mStart = startOfMonth(selectedMonth);
      const mEnd = endOfMonth(selectedMonth);
      const byProduct = new Map<string, ProductAgg>();

      const ensure = (id: string, name: string) => {
        let row = byProduct.get(id);
        if (!row) {
          row = {
            productId: id,
            productName: name,
            current: 0,
            afterStart: 0,
            afterEnd: 0,
            entradas: 0,
            salidas: 0,
          };
          byProduct.set(id, row);
        }
        return row;
      };

      for (const s of stocks) {
        const row = ensure(s.productId, s.product.name);
        row.current += s.quantity;
      }

      for (const m of allMovements) {
        const row = ensure(m.productId, m.product.name);
        const delta = movementDelta(m.type, m.quantity);
        if (m.createdAt >= mStart) row.afterStart += delta;
        if (m.createdAt > mEnd) row.afterEnd += delta;
        if (m.createdAt >= mStart && m.createdAt <= mEnd) {
          if (m.type === "salida") row.salidas += m.quantity;
          else row.entradas += m.quantity;
        }
      }

      const items = [...byProduct.values()]
        .map((row) => ({
          productId: row.productId,
          productName: row.productName,
          stockInicial: row.current - row.afterStart,
          entradas: row.entradas,
          salidas: row.salidas,
          stockFinal: row.current - row.afterEnd,
        }))
        .filter(
          (row) =>
            row.stockInicial !== 0 ||
            row.stockFinal !== 0 ||
            row.entradas !== 0 ||
            row.salidas !== 0
        )
        .sort((a, b) => a.productName.localeCompare(b.productName, "es"));

      monthStock = {
        month: `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`,
        label: monthLabel(selectedMonth),
        stockInicial: items.reduce((s, i) => s + i.stockInicial, 0),
        entradas: items.reduce((s, i) => s + i.entradas, 0),
        salidas: items.reduce((s, i) => s + i.salidas, 0),
        stockFinal: items.reduce((s, i) => s + i.stockFinal, 0),
        items,
      };
    }

    return NextResponse.json({
      movements,
      summary: {
        ...summary,
        totalMovimientos: movements.length,
      },
      monthStock,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
