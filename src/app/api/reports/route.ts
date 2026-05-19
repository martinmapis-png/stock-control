import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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
        (where.createdAt as Record<string, Date>).gte = startOfDay(new Date(dateFrom));
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = endOfDay(new Date(dateTo));
      }
    }

    const movements = await prisma.movement.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        technician: true,
      },
      orderBy: { createdAt: "desc" },
    });

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

    return NextResponse.json({
      movements,
      summary: {
        ...summary,
        totalMovimientos: movements.length,
      },
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
