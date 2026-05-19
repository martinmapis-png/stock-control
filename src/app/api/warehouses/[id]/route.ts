import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: { stock: { include: { product: true } } },
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Depósito no encontrado" }, { status: 404 });
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error fetching warehouse:", error);
    return NextResponse.json({ error: "Error al obtener depósito" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, location } = body;

    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Depósito no encontrado" }, { status: 404 });
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name: name.trim(),
        location: location?.trim() || null,
      },
      include: { stock: { include: { product: true } } },
    });

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error updating warehouse:", error);
    return NextResponse.json({ error: "Error al actualizar depósito" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Depósito no encontrado" }, { status: 404 });
    }

    await prisma.warehouse.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return NextResponse.json({ error: "Error al eliminar depósito" }, { status: 500 });
  }
}
