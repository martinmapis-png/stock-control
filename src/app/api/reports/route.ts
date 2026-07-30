import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

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
      prisma.stock.findMany({
        where: stockScope,
        select: { quantity: true },
      }),
      prisma.movement.findMany({
        where: stockScope,
        select: { type: true, quantity: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
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

    const currentStock = stocks.reduce((sum, s) => sum + s.quantity, 0);
    const now = new Date();

    let rangeStart = startOfMonth(now);
    let rangeEnd = endOfMonth(now);

    if (dateFrom) {
      rangeStart = startOfMonth(parseLocalDate(dateFrom));
    } else if (allMovements.length > 0) {
      rangeStart = startOfMonth(allMovements[0].createdAt);
    }

    if (dateTo) {
      rangeEnd = endOfMonth(parseLocalDate(dateTo));
    }

    const monthlyStock: {
      month: string;
      label: string;
      stockInicial: number;
      entradas: number;
      salidas: number;
      stockFinal: number;
    }[] = [];

    for (
      let cursor = new Date(rangeStart);
      cursor <= rangeEnd;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      const mStart = startOfMonth(cursor);
      const mEnd = endOfMonth(cursor);

      let afterStart = 0;
      let afterEnd = 0;
      let entradas = 0;
      let salidas = 0;

      for (const m of allMovements) {
        const delta = movementDelta(m.type, m.quantity);
        if (m.createdAt >= mStart) afterStart += delta;
        if (m.createdAt > mEnd) afterEnd += delta;
        if (m.createdAt >= mStart && m.createdAt <= mEnd) {
          if (m.type === "salida") salidas += m.quantity;
          else entradas += m.quantity;
        }
      }

      monthlyStock.push({
        month: monthKey(cursor),
        label: monthLabel(cursor),
        stockInicial: currentStock - afterStart,
        entradas,
        salidas,
        stockFinal: currentStock - afterEnd,
      });
    }

    return NextResponse.json({
      movements,
      summary: {
        ...summary,
        totalMovimientos: movements.length,
      },
      monthlyStock,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
