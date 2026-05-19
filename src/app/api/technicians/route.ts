import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";

    const technicians = await prisma.technician.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { name: "asc" },
    });

    return NextResponse.json(technicians);
  } catch (error) {
    console.error("Error fetching technicians:", error);
    return NextResponse.json({ error: "Error al obtener técnicos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    const technician = await prisma.technician.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(technician);
  } catch (error) {
    console.error("Error creating technician:", error);
    return NextResponse.json({ error: "Error al crear técnico" }, { status: 500 });
  }
}
