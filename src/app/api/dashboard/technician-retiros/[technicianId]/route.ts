import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ technicianId: string }> }
) {
  try {
    const { technicianId } = await params;

    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
    });
    if (!technician) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }

    const movements = await prisma.movement.findMany({
      where: { type: "salida", technicianId },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
    });

    const items = movements.map((m) => ({
      id: m.id,
      productName: m.product.name,
      quantity: m.quantity,
      warehouseName: m.warehouse.name,
      reason: m.reason,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ technicianName: technician.name, items });
  } catch (error) {
    console.error("Error technician retiros:", error);
    return NextResponse.json({ error: "Error al obtener retiros" }, { status: 500 });
  }
}
