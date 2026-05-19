import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const technician = await prisma.technician.findUnique({
      where: { id },
    });

    if (!technician) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }

    return NextResponse.json(technician);
  } catch (error) {
    console.error("Error fetching technician:", error);
    return NextResponse.json({ error: "Error al obtener técnico" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, active } = body;

    const existing = await prisma.technician.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name?.trim()) data.name = name.trim();
    if (active !== undefined) data.active = active;

    const technician = await prisma.technician.update({
      where: { id },
      data,
    });

    return NextResponse.json(technician);
  } catch (error) {
    console.error("Error updating technician:", error);
    return NextResponse.json({ error: "Error al actualizar técnico" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.technician.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }

    await prisma.technician.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting technician:", error);
    return NextResponse.json({ error: "Error al eliminar técnico" }, { status: 500 });
  }
}
