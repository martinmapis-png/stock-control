import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [salidas, allMovements] = await Promise.all([
      prisma.movement.findMany({
        where: { type: "salida", technicianId: { not: null } },
        include: { technician: true },
      }),
      prisma.movement.findMany({ select: { type: true, quantity: true } }),
    ]);

    let totalEntradas = 0;
    let totalSalidas = 0;
    allMovements.forEach((m) => {
      if (m.type === "entrada" || m.type === "ajuste") {
        totalEntradas += m.quantity;
      } else if (m.type === "salida") {
        totalSalidas += m.quantity;
      }
    });

    const byTechnician = salidas.reduce(
      (acc, m) => {
        if (!m.technician) return acc;
        const id = m.technician.id;
        if (!acc[id]) {
          acc[id] = { name: m.technician.name, total: 0, count: 0 };
        }
        acc[id].total += m.quantity;
        acc[id].count += 1;
        return acc;
      },
      {} as Record<string, { name: string; total: number; count: number }>
    );

    const retirosPorTecnico = Object.entries(byTechnician)
      .map(([technicianId, v]) => ({
        technicianId,
        name: v.name,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      retirosPorTecnico,
      totalEntradas,
      totalSalidas,
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}
