import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getTechnicianProductStock(
  db: DbClient,
  technicianId: string,
  productId: string
): Promise<number> {
  const [salidas, entradas] = await Promise.all([
    db.movement.aggregate({
      where: { technicianId, productId, type: "salida" },
      _sum: { quantity: true },
    }),
    db.movement.aggregate({
      where: { technicianId, productId, type: "entrada" },
      _sum: { quantity: true },
    }),
  ]);
  return (salidas._sum.quantity ?? 0) - (entradas._sum.quantity ?? 0);
}

/** Stock por producto para un técnico (solo productos con saldo > 0 si onlyPositive). */
export async function getTechnicianStockByProduct(
  db: DbClient,
  technicianId: string,
  options?: { productIds?: string[]; onlyPositive?: boolean }
): Promise<Map<string, number>> {
  const where = {
    technicianId,
    type: { in: ["salida", "entrada"] },
    ...(options?.productIds?.length ? { productId: { in: options.productIds } } : {}),
  };

  const movements = await db.movement.findMany({
    where,
    select: { productId: true, type: true, quantity: true },
  });

  const map = new Map<string, number>();
  for (const m of movements) {
    const cur = map.get(m.productId) ?? 0;
    const delta = m.type === "salida" ? m.quantity : -m.quantity;
    map.set(m.productId, cur + delta);
  }

  if (options?.onlyPositive !== false) {
    for (const [pid, qty] of [...map.entries()]) {
      if (qty <= 0) map.delete(pid);
    }
  }

  return map;
}

export class InsufficientTechnicianStockError extends Error {
  constructor(
    public productName: string,
    public available: number
  ) {
    super(
      JSON.stringify({
        code: "INSUFFICIENT_TECHNICIAN_STOCK",
        productName,
        available,
      })
    );
  }
}

export async function assertTechnicianStockForEntrada(
  db: DbClient,
  technicianId: string,
  productId: string,
  quantity: number,
  productName: string,
  pendingInBatch: Map<string, number>
): Promise<void> {
  const inDb = await getTechnicianProductStock(db, technicianId, productId);
  const pending = pendingInBatch.get(productId) ?? 0;
  const available = inDb - pending;
  if (quantity > available) {
    throw new InsufficientTechnicianStockError(productName, available);
  }
  pendingInBatch.set(productId, pending + quantity);
}

export async function getTechnicianStockWithProducts(technicianId: string) {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, active: true },
  });
  if (!technician) return null;

  const stockMap = await getTechnicianStockByProduct(prisma, technicianId);
  const productIds = [...stockMap.keys()];
  if (productIds.length === 0) {
    return { technicianId, technicianName: technician.name, items: [] as { productId: string; name: string; quantity: number }[] };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const items = productIds
    .map((productId) => ({
      productId,
      name: nameById.get(productId) ?? productId,
      quantity: stockMap.get(productId) ?? 0,
    }))
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { technicianId, technicianName: technician.name, items };
}
