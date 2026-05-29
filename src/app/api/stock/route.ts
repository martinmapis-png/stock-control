import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertTechnicianStockForEntrada,
  InsufficientTechnicianStockError,
} from "@/lib/technician-stock";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, warehouseId, type, quantity, reason, notes, technicianId } = body;

    if (!productId || !warehouseId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: "productId, warehouseId, type y quantity son requeridos" },
        { status: 400 }
      );
    }

    const qty = parseInt(String(quantity), 10);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser un número positivo" }, { status: 400 });
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

    const needsTechnician =
      (type === "salida" || type === "entrada") && Boolean(technicianId);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });

    if (!product || !warehouse) {
      return NextResponse.json({ error: "Producto o depósito no encontrado" }, { status: 404 });
    }

    if (needsTechnician) {
      const technician = await prisma.technician.findFirst({
        where: { id: technicianId, active: true },
      });
      if (!technician) {
        return NextResponse.json({ error: "Técnico no válido o inactivo" }, { status: 400 });
      }
    }

    let stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stock) {
      stock = await prisma.stock.create({
        data: { productId, warehouseId, quantity: 0 },
      });
    }

    const quantityChange = type === "salida" ? -qty : qty;
    const newQuantity = stock.quantity + quantityChange;

    if (newQuantity < 0) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${stock.quantity}` },
        { status: 400 }
      );
    }

    const movementTechnicianId =
      (type === "salida" || type === "entrada") && technicianId ? technicianId : null;

    await prisma.$transaction(async (tx) => {
      if (type === "entrada" && movementTechnicianId) {
        const pending = new Map<string, number>();
        await assertTechnicianStockForEntrada(
          tx,
          movementTechnicianId,
          productId,
          qty,
          product.name,
          pending
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
          technicianId: movementTechnicianId,
        },
      });
    });

    const updatedStock = await prisma.stock.findUnique({
      where: { id: stock.id },
      include: { product: true, warehouse: true },
    });

    return NextResponse.json(updatedStock);
  } catch (error) {
    if (error instanceof InsufficientTechnicianStockError) {
      return NextResponse.json(
        {
          error: `El técnico no tiene suficiente stock de «${error.productName}». En su poder: ${error.available}`,
        },
        { status: 400 }
      );
    }
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Error al actualizar stock" }, { status: 500 });
  }
}
