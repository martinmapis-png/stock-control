import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const productInclude = {
  stock: { include: { warehouse: true } },
  categories: { select: { id: true, name: true }, orderBy: { name: "asc" as const } },
};

async function resolveCategoryIds(categoryIds: unknown) {
  if (!Array.isArray(categoryIds)) {
    return { ok: false as const, error: "Las categorías tienen que ser una lista" };
  }
  const ids = [...new Set(categoryIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))];
  if (ids.length === 0) return { ok: true as const, ids: [] as string[] };
  const found = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) {
    return { ok: false as const, error: "Hay categorías que no existen" };
  }
  return { ok: true as const, ids };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, sku, barcode, description, lowStockThreshold, categoryIds } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof name === "string") {
      if (!name.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (sku !== undefined) data.sku = sku?.trim() || null;
    if (barcode !== undefined) data.barcode = barcode?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (lowStockThreshold !== undefined) {
      const val = lowStockThreshold === "" || lowStockThreshold === null
        ? null
        : Math.max(0, parseInt(String(lowStockThreshold), 10));
      data.lowStockThreshold = val !== null && !isNaN(val) ? val : null;
    }
    if (categoryIds !== undefined) {
      const categories = await resolveCategoryIds(categoryIds);
      if (!categories.ok) {
        return NextResponse.json({ error: categories.error }, { status: 400 });
      }
      data.categories = { set: categories.ids.map((categoryId) => ({ id: categoryId })) };
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese SKU ya está usado por otro producto" }, { status: 400 });
    }
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actingUserId = request.headers.get("X-Acting-User-Id")?.trim();
    if (!actingUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { role: true, active: true },
    });
    if (!actor?.active || actor.role !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede eliminar productos" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true, name: existing.name });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
