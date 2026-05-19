import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const techniciansOnly = searchParams.get("technicians") === "true";
    const activeOnly = searchParams.get("active") !== "false";

    const users = await prisma.user.findMany({
      where: {
        ...(techniciansOnly ? { isTechnician: true } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canAddProducts: true,
        isTechnician: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role, canAddProducts, isTechnician } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });
    }

    const validRoles = ["admin", "producto", "tecnico", "operador"];
    const userRole = validRoles.includes(role) ? role : "operador";

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: userRole,
        canAddProducts: canAddProducts === true || userRole === "admin" || userRole === "producto",
        isTechnician: isTechnician === true || userRole === "tecnico",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canAddProducts: true,
        isTechnician: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
