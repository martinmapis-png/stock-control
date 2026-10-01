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

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Día calendario de Argentina (UTC-3, sin horario de verano). */
function argentinaDayRange(iso: string) {
  if (!DAY_RE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return {
    start: new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999)),
    label: new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
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

async function dayExitsReport(day: string, technicianId: string | null) {
  const range = argentinaDayRange(day);
  if (!range) {
    return NextResponse.json({ error: "Día inválido" }, { status: 400 });
  }

  let technicianName: string | null = null;
  if (technicianId) {
    const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!technician) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }
    technicianName = technician.name;
  }

  const movements = await prisma.movement.findMany({
    where: {
      type: { in: ["salida", "entrada"] },
      createdAt: { gte: range.start, lte: range.end },
      ...(technicianId ? { technicianId } : {}),
    },
    include: {
      product: true,
      warehouse: true,
      technician: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const salidas = movements.filter((movement) => movement.type === "salida");
  const entradas = movements.filter((movement) => movement.type === "entrada");

  const byProduct = new Map<
    string,
    {
      productId: string;
      productName: string;
      entradas: number;
      salidas: number;
      technicians: Set<string>;
    }
  >();

  const ensure = (productId: string, productName: string) => {
    let row = byProduct.get(productId);
    if (!row) {
      row = { productId, productName, entradas: 0, salidas: 0, technicians: new Set<string>() };
      byProduct.set(productId, row);
    }
    return row;
  };

  for (const movement of movements) {
    const row = ensure(movement.productId, movement.product.name);
    if (movement.type === "entrada") row.entradas += movement.quantity;
    else row.salidas += movement.quantity;
    if (movement.technician?.name) row.technicians.add(movement.technician.name);
  }

  const summarize = (list: typeof movements) => {
    const totals = new Map<string, { productId: string; productName: string; quantity: number; technicians: Set<string> }>();
    for (const movement of list) {
      let row = totals.get(movement.productId);
      if (!row) {
        row = {
          productId: movement.productId,
          productName: movement.product.name,
          quantity: 0,
          technicians: new Set<string>(),
        };
        totals.set(movement.productId, row);
      }
      row.quantity += movement.quantity;
      if (movement.technician?.name) row.technicians.add(movement.technician.name);
    }
    const items = [...totals.values()]
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        technicians: [...row.technicians].sort((a, b) => a.localeCompare(b, "es")),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, "es"));
    return {
      day,
      label: range.label,
      technicianId: technicianId || null,
      technicianName,
      totalUnidades: items.reduce((sum, item) => sum + item.quantity, 0),
      totalMovimientos: list.length,
      items,
      movements: list,
    };
  };

  const differences = [...byProduct.values()]
    .map((row) => ({
      productId: row.productId,
      productName: row.productName,
      entradas: row.entradas,
      salidas: row.salidas,
      diferencia: row.entradas - row.salidas,
      technicians: [...row.technicians].sort((a, b) => a.localeCompare(b, "es")),
    }))
    .sort((a, b) => {
      const aDiff = a.diferencia !== 0 ? 0 : 1;
      const bDiff = b.diferencia !== 0 ? 0 : 1;
      if (aDiff !== bDiff) return aDiff - bDiff;
      return a.productName.localeCompare(b.productName, "es");
    });

  return NextResponse.json({
    dayExits: summarize(salidas),
    dayEntries: summarize(entradas),
    differences,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");
    if (day) {
      return dayExitsReport(day, searchParams.get("technicianId"));
    }

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
