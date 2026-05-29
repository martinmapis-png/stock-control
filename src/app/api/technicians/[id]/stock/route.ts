import { NextRequest, NextResponse } from "next/server";
import { getTechnicianProductStock, getTechnicianStockWithProducts } from "@/lib/technician-stock";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: technicianId } = await params;
    const productId = new URL(request.url).searchParams.get("productId");

    if (productId) {
      const technician = await prisma.technician.findFirst({
        where: { id: technicianId, active: true },
      });
      if (!technician) {
        return NextResponse.json({ error: "Técnico no válido o inactivo" }, { status: 404 });
      }
      const quantity = await getTechnicianProductStock(prisma, technicianId, productId);
      return NextResponse.json({ technicianId, productId, quantity });
    }

    const data = await getTechnicianStockWithProducts(technicianId);
    if (!data) {
      return NextResponse.json({ error: "Técnico no válido o inactivo" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error technician stock:", error);
    return NextResponse.json({ error: "Error al obtener stock del técnico" }, { status: 500 });
  }
}
