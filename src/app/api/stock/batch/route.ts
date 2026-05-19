import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { warehouseId, type, reason, notes, technicianId, lines } = body;

    if (!warehouseId || !type || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "Depósito, tipo y al menos una línea con producto y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const validTypes = ["entrada", "salida", "ajuste"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 });
    }

    if (type === "salida" && !technicianId) {
      return NextResponse.json(
        { error: "Las salidas requieren un técnico responsable" },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return NextResponse.json({ error: "Depósito no encontrado" }, { status: 404 });
    }

    if (technicianId && type === "salida") {
      const technician = await prisma.technician.findFirst({
        where: { id: technicianId, active: true },
      });
      if (!technician) {
        return NextResponse.json({ error: "Técnico no válido o inactivo" }, { status: 400 });
      }
    }

    const normalized: { productId: string; quantity: number }[] = [];
    for (const line of lines) {
      const pid = line?.productId;
      const q = parseInt(String(line?.quantity), 10);
      if (!pid || isNaN(q) || q <= 0) {
        return NextResponse.json(
          { error: "Cada línea debe tener un producto y una cantidad mayor a 0" },
          { status: 400 }
        );
      }
      normalized.push({ productId: pid, quantity: q });
    }

    const merged = new Map<string, number>();
    for (const { productId, quantity } of normalized) {
      merged.set(productId, (merged.get(productId) ?? 0) + quantity);
    }
    const finalLines = [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));

    const productIds = [...new Set(finalLines.map((l) => l.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Uno o más productos no existen" }, { status: 404 });
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    try {
      await prisma.$transaction(async (tx) => {
        for (const { productId, quantity: qty } of finalLines) {
          let stock = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId, warehouseId } },
          });
          if (!stock) {
            stock = await tx.stock.create({
              data: { productId, warehouseId, quantity: 0 },
            });
          }
          const quantityChange = type === "salida" ? -qty : qty;
          const newQuantity = stock.quantity + quantityChange;
          if (newQuantity < 0) {
            const p = productMap.get(productId)!;
            throw new Error(
              JSON.stringify({
                code: "INSUFFICIENT_STOCK",
                productName: p.name,
                available: stock.quantity,
              })
            );
          }
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: newQuantity },
          });
          await tx.movement.create({
            data: {
              productId,
              warehouseId,
              type,
              quantity: qty,
              reason: reason?.trim() || null,
              notes: notes?.trim() || null,
              technicianId: type === "salida" ? technicianId : null,
            },
          });
        }
      });
    } catch (e) {
      if (e instanceof Error) {
        try {
          const j = JSON.parse(e.message) as {
            code?: string;
            productName?: string;
            available?: number;
          };
          if (j.code === "INSUFFICIENT_STOCK" && j.productName != null && j.available != null) {
            return NextResponse.json(
              {
                error: `Stock insuficiente para «${j.productName}». Disponible: ${j.available}`,
              },
              { status: 400 }
            );
          }
        } catch {
          /* not our payload */
        }
      }
      throw e;
    }

    return NextResponse.json({ ok: true, movements: finalLines.length });
  } catch (error) {
    console.error("Error batch stock:", error);
    return NextResponse.json({ error: "Error al registrar movimientos" }, { status: 500 });
  }
}
