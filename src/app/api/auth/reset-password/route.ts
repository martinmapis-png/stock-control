import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * Resetea las contraseñas de los usuarios por defecto.
 * Útil cuando hay problemas con el login.
 * POST /api/auth/reset-password
 */
export async function POST() {
  try {
    const adminHash = await bcrypt.hash("admin123", 10);
    const stockHash = await bcrypt.hash("admin3232", 10);

    for (const { email, passwordHash, name, role } of [
      { email: "admin@stockcontrol.local", passwordHash: adminHash, name: "Administrador", role: "admin" },
      { email: "stock@control", passwordHash: stockHash, name: "Stock Control", role: "admin" },
    ]) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, active: true },
        });
      } else {
        await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role,
            canAddProducts: true,
            isTechnician: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Contraseñas reseteadas. Usa: stock@control / admin3232  o  admin@stockcontrol.local / admin123",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: `Error al resetear contraseña: ${msg}` },
      { status: 500 }
    );
  }
}
