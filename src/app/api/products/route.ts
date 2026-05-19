import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const barcode = searchParams.get("barcode");
    const sku = searchParams.get("sku");

    if (barcode) {
      const product = await prisma.product.findFirst({
        where: { barcode },
        include: { stock: { include: { warehouse: true } } },
      });
      return NextResponse.json(product);
    }

    if (sku) {
      const product = await prisma.product.findFirst({
        where: { sku },
        include: { stock: { include: { warehouse: true } } },
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
            ],
          }
        : undefined,
      include: { stock: { include: { warehouse: true } } },
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
    const { name, sku, barcode, description, lowStockThreshold, initialWarehouseId, initialQuantity } = body;

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

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku?.trim() || null,
          barcode: barcode?.trim() || null,
          description: description?.trim() || null,
          lowStockThreshold: threshold,
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

      return p;
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
