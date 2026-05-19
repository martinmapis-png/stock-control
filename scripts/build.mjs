import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

run("prisma generate");

if (process.env.DATABASE_URL) {
  run("prisma migrate deploy");
} else {
  console.warn("⚠ DATABASE_URL no definida: se omiten migraciones (configúrala en Vercel y redeploy).");
}

run("next build");
