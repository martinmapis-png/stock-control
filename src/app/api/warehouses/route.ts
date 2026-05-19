import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        stock: { include: { product: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    return NextResponse.json({ error: "Error al obtener depósitos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, location } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: name.trim(),
        location: location?.trim() || null,
      },
    });

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error creating warehouse:", error);
    return NextResponse.json({ error: "Error al crear depósito" }, { status: 500 });
  }
}
