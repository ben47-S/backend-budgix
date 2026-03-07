/**
 * Script pour vérifier et corriger l'admin si nécessaire
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";

async function checkAndFixAdmin() {
  const email = "admin@budgix.com";
  const password = "Admin123456";

  console.log(`🔍 Vérification de l'admin : ${email}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      password: true,
      username: true,
    },
  });

  if (!user) {
    console.error(`❌ Utilisateur non trouvé avec l'email : ${email}`);
    console.log("\nPour créer un admin, utilisez :");
    console.log(`  pnpm admin:create-complete --email ${email} --password "${password}"`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("✅ Utilisateur trouvé :");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Username: ${user.username || "N/A"}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Mot de passe défini: ${user.password ? "Oui" : "Non"}\n`);

  if (user.role !== "ADMIN") {
    console.log("⚠️  L'utilisateur n'est pas ADMIN, promotion en cours...");
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    console.log("✅ Utilisateur promu au rôle ADMIN\n");
  }

  if (!user.password) {
    console.log("⚠️  Aucun mot de passe défini, définition en cours...");
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    console.log("✅ Mot de passe défini\n");
  } else {
    // Vérifier si le mot de passe fonctionne
    console.log("🔐 Vérification du mot de passe...");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log("⚠️  Le mot de passe actuel ne correspond pas, réinitialisation...");
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
      console.log("✅ Mot de passe réinitialisé\n");
    } else {
      console.log("✅ Le mot de passe est correct\n");
    }
  }

  console.log("✅ Admin configuré correctement !");
  console.log("\nVous pouvez maintenant vous connecter avec :");
  console.log(`   Email: ${email}`);
  console.log(`   Mot de passe: ${password}`);
  console.log("\nRoute: POST /api/admin/auth/login");
}

checkAndFixAdmin()
  .catch((error) => {
    console.error("❌ Erreur :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

