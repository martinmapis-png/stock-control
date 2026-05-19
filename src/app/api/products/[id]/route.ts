import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { stock: { include: { warehouse: true } } },
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
    const { name, sku, barcode, description, lowStockThreshold } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name?.trim() !== undefined) data.name = name.trim();
    if (sku !== undefined) data.sku = sku?.trim() || null;
    if (barcode !== undefined) data.barcode = barcode?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (lowStockThreshold !== undefined) {
      const val = lowStockThreshold === "" || lowStockThreshold === null
        ? null
        : Math.max(0, parseInt(String(lowStockThreshold), 10));
      data.lowStockThreshold = val !== null && !isNaN(val) ? val : null;
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { stock: { include: { warehouse: true } } },
    });

    return NextResponse.json(product);
  } catch (error) {
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
