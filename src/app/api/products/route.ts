import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const productInclude = {
  stock: { include: { warehouse: true } },
  categories: { select: { id: true, name: true }, orderBy: { name: "asc" as const } },
};

async function resolveCategoryIds(categoryIds: unknown) {
  if (categoryIds === undefined) return { ok: true as const, ids: undefined };
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const barcode = searchParams.get("barcode");
    const sku = searchParams.get("sku");

    if (barcode) {
      const product = await prisma.product.findFirst({
        where: { barcode },
        include: productInclude,
      });
      return NextResponse.json(product);
    }

    if (sku) {
      const product = await prisma.product.findFirst({
        where: { sku },
        include: productInclude,
      });
      return NextResponse.json(product);
    }

    const products = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
              { barcode: { contains: search } },
              { categories: { some: { name: { contains: search } } } },
            ],
          }
        : undefined,
      include: productInclude,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sku, barcode, description, lowStockThreshold, initialWarehouseId, initialQuantity, categoryIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    let threshold: number | null = null;
    if (lowStockThreshold !== undefined && lowStockThreshold !== null && lowStockThreshold !== "") {
      const n = parseInt(String(lowStockThreshold), 10);
      threshold = !isNaN(n) ? Math.max(0, n) : null;
    }

    let initialQ = 0;
    const qtyRaw =
      initialQuantity !== undefined && initialQuantity !== null && initialQuantity !== ""
        ? parseInt(String(initialQuantity), 10)
        : NaN;
    if (!isNaN(qtyRaw) && qtyRaw > 0) {
      initialQ = qtyRaw;
    }

    if (initialQ > 0 && !initialWarehouseId?.trim()) {
      return NextResponse.json(
        { error: "Para cargar cantidad inicial tenés que elegir un depósito" },
        { status: 400 }
      );
    }

    if (initialQ > 0) {
      const wh = await prisma.warehouse.findUnique({ where: { id: initialWarehouseId.trim() } });
      if (!wh) {
        return NextResponse.json({ error: "Depósito no encontrado" }, { status: 400 });
      }
    }

    const categories = await resolveCategoryIds(categoryIds);
    if (!categories.ok) {
      return NextResponse.json({ error: categories.error }, { status: 400 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku?.trim() || null,
          barcode: barcode?.trim() || null,
          description: description?.trim() || null,
          lowStockThreshold: threshold,
          ...(categories.ids && categories.ids.length > 0
            ? { categories: { connect: categories.ids.map((id) => ({ id })) } }
            : {}),
        },
      });

      if (initialQ > 0 && initialWarehouseId?.trim()) {
        await tx.stock.create({
          data: {
            productId: p.id,
            warehouseId: initialWarehouseId.trim(),
            quantity: initialQ,
          },
        });
        await tx.movement.create({
          data: {
            productId: p.id,
            warehouseId: initialWarehouseId.trim(),
            type: "entrada",
            quantity: initialQ,
            reason: "Carga inicial al crear producto",
            technicianId: null,
          },
        });
      }

      return tx.product.findUnique({
        where: { id: p.id },
        include: productInclude,
      });
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
