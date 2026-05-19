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

  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@stockcontrol.local" },
    create: {
      name: "Administrador",
      email: "admin@stockcontrol.local",
      passwordHash: adminHash,
      role: "admin",
      canAddProducts: true,
      isTechnician: true,
    },
    update: { passwordHash: adminHash, active: true },
  });
  console.log("✓ Usuario admin listo (email: admin@stockcontrol.local, contraseña: admin123)");

  const stockHash = await bcrypt.hash("admin3232", 10);
  await prisma.user.upsert({
    where: { email: "stock@control" },
    create: {
      name: "Stock Control",
      email: "stock@control",
      passwordHash: stockHash,
      role: "admin",
      canAddProducts: true,
      isTechnician: true,
    },
    update: { passwordHash: stockHash, active: true },
  });
  console.log("✓ Usuario stock listo (email: stock@control, contraseña: admin3232)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
