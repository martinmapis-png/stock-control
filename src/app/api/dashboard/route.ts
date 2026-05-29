import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [withTechnician, allMovements] = await Promise.all([
      prisma.movement.findMany({
        where: {
          technicianId: { not: null },
          type: { in: ["salida", "entrada"] },
        },
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

    const byTechnician = withTechnician.reduce(
      (acc, m) => {
        if (!m.technician) return acc;
        const id = m.technician.id;
        if (!acc[id]) {
          acc[id] = { name: m.technician.name, enPoder: 0, retiros: 0, devoluciones: 0 };
        }
        if (m.type === "salida") {
          acc[id].enPoder += m.quantity;
          acc[id].retiros += 1;
        } else if (m.type === "entrada") {
          acc[id].enPoder -= m.quantity;
          acc[id].devoluciones += 1;
        }
        return acc;
      },
      {} as Record<
        string,
        { name: string; enPoder: number; retiros: number; devoluciones: number }
      >
    );

    const retirosPorTecnico = Object.entries(byTechnician)
      .map(([technicianId, v]) => ({
        technicianId,
        name: v.name,
        total: v.enPoder,
        count: v.retiros,
        devoluciones: v.devoluciones,
      }))
      .filter((t) => t.total > 0 || t.count > 0 || t.devoluciones > 0)
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
