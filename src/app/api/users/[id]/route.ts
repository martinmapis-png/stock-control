import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, password, role, canAddProducts, isTechnician, active } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (name?.trim()) data.name = name.trim();
    if (email?.trim()) {
      const emailLower = email.trim().toLowerCase();
      if (emailLower !== existing.email) {
        const duplicate = await prisma.user.findUnique({ where: { email: emailLower } });
        if (duplicate) {
          return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });
        }
        data.email = emailLower;
      }
    }
    if (password && password.length >= 6) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    if (role !== undefined) {
      const validRoles = ["admin", "producto", "tecnico", "operador"];
      data.role = validRoles.includes(role) ? role : existing.role;
    }
    if (canAddProducts !== undefined) data.canAddProducts = canAddProducts;
    if (isTechnician !== undefined) data.isTechnician = isTechnician;
    if (active !== undefined) data.active = active;

    const user = await prisma.user.update({
      where: { id },
      data,
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
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
