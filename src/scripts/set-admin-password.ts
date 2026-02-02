/**
 * Script pour définir ou mettre à jour le mot de passe d'un administrateur
 * 
 * Usage:
 *   pnpm tsx src/scripts/set-admin-password.ts --email <email> <password>
 *   ou
 *   pnpm tsx src/scripts/set-admin-password.ts --id <userId> <password>
 */

import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";

async function setAdminPassword() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("❌ Erreur : Vous devez fournir un email ou un ID utilisateur et un mot de passe");
    console.log("\nUsage:");
    console.log("  pnpm tsx src/scripts/set-admin-password.ts --email <email> <password>");
    console.log("  pnpm tsx src/scripts/set-admin-password.ts --id <userId> <password>");
    console.log("\nExemple:");
    console.log('  pnpm tsx src/scripts/set-admin-password.ts --email admin@budgix.com "MonMotDePasse123"');
    process.exit(1);
  }

  let user;
  let password: string;

  // Vérifier si c'est un email ou un ID avec flag
  if (args[0] === "--email" && args[1] && args[2]) {
    const email = args[1];
    password = args[2];

    user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email : ${email}`);
      process.exit(1);
    }
  } else if (args[0] === "--id" && args[1] && args[2]) {
    const userId = args[1];
    password = args[2];

    user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'ID : ${userId}`);
      process.exit(1);
    }
  } else {
    console.error("❌ Format invalide. Utilisez --email ou --id");
    console.log("\nUsage:");
    console.log("  pnpm tsx src/scripts/set-admin-password.ts --email <email> <password>");
    console.log("  pnpm tsx src/scripts/set-admin-password.ts --id <userId> <password>");
    process.exit(1);
  }

  // Vérifier que l'utilisateur est admin
  if (user.role !== "ADMIN") {
    console.error(`❌ L'utilisateur n'est pas un administrateur. Role actuel : ${user.role}`);
    console.log("\nPour promouvoir un utilisateur au rôle ADMIN, utilisez :");
    console.log("  pnpm admin:create --email <email>");
    process.exit(1);
  }

  // Vérifier la longueur minimale du mot de passe
  if (password.length < 8) {
    console.error("❌ Le mot de passe doit contenir au moins 8 caractères");
    process.exit(1);
  }

  // Hasher le mot de passe avec bcrypt (10 rounds)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Mettre à jour le mot de passe
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      role: true,
      isPremium: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log("✅ Mot de passe défini avec succès pour l'administrateur !");
  console.log("\nDétails de l'utilisateur :");
  console.log(`   ID: ${updatedUser.id}`);
  console.log(`   Email: ${updatedUser.email || "N/A"}`);
  console.log(`   Phone: ${updatedUser.phone || "N/A"}`);
  console.log(`   Username: ${updatedUser.username || "N/A"}`);
  console.log(`   Role: ${updatedUser.role}`);
  console.log(`   Premium: ${updatedUser.isPremium ? "Oui" : "Non"}`);
  console.log(`   Mis à jour le: ${updatedUser.updatedAt.toISOString()}`);
  console.log("\n✅ L'administrateur peut maintenant se connecter avec :");
  console.log(`   Email: ${updatedUser.email || "N/A"}`);
  console.log(`   Mot de passe: [le mot de passe que vous avez fourni]`);
  console.log("\nRoute de connexion : POST /api/admin/auth/login");
}

setAdminPassword()
  .catch((error) => {
    console.error("❌ Erreur lors de la définition du mot de passe :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

