import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username ?? body.email ?? "").trim().toLowerCase();
    const { password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: username },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const passwordStr = String(password).trim();
    let valid = false;

    try {
      valid = await bcrypt.compare(passwordStr, user.passwordHash);
    } catch (e) {
      console.error("Error en bcrypt:", e);
      return NextResponse.json(
        { error: "Error al verificar contraseña. Haz clic en 'Resetear contraseña del admin' e intenta de nuevo." },
        { status: 500 }
      );
    }

    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      canAddProducts: user.canAddProducts,
      isTechnician: user.isTechnician,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}
