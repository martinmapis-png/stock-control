import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const categoryInclude = {
  products: {
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" as const },
  },
};

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const duplicate = await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name },
      include: categoryInclude,
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}
