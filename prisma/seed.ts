import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const warehouseCount = await prisma.warehouse.count();
  if (warehouseCount === 0) {
    await prisma.warehouse.create({
      data: { name: "Depósito Principal", location: "Sede central" },
    });
    console.log("✓ Depósito Principal creado");
  }

  const technicianCount = await prisma.technician.count();
  if (technicianCount === 0) {
    await prisma.technician.createMany({
      data: [
        { name: "Técnico 1" },
        { name: "Técnico 2" },
      ],
    });
    console.log("✓ Técnicos de ejemplo creados");
  }

  const adminHash = await bcrypt.hash("admin", 10);
  await prisma.user.upsert({
    where: { email: "admin" },
    create: {
      name: "Administrador",
      email: "admin",
      passwordHash: adminHash,
      role: "admin",
      canAddProducts: true,
      isTechnician: true,
    },
    update: { passwordHash: adminHash, active: true },
  });
  console.log("✓ Usuario admin listo (usuario: admin, contraseña: admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
