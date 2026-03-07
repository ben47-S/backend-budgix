/**
 * Script pour créer un administrateur complet directement
 * 
 * Crée un utilisateur avec le rôle ADMIN et définit son mot de passe en une seule commande
 * 
 * Usage:
 *   pnpm tsx src/scripts/create-admin-complete.ts --email <email> --password <password> [--username <username>]
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";

async function createAdminComplete() {
  const args = process.argv.slice(2);

  // Parser les arguments
  let email: string | undefined;
  let password: string | undefined;
  let username: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === "--password" && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === "--username" && args[i + 1]) {
      username = args[i + 1];
      i++;
    }
  }

  // Vérifier les paramètres requis
  if (!email || !password) {
    console.error("❌ Erreur : Email et mot de passe requis");
    console.log("\nUsage:");
    console.log("  pnpm tsx src/scripts/create-admin-complete.ts --email <email> --password <password> [--username <username>]");
    console.log("\nExemple:");
    console.log('  pnpm tsx src/scripts/create-admin-complete.ts --email admin@budgix.com --password "SecurePassword123" --username admin');
    process.exit(1);
  }

  // Vérifier la longueur minimale du mot de passe
  if (password.length < 8) {
    console.error("❌ Le mot de passe doit contenir au moins 8 caractères");
    process.exit(1);
  }

  // Normaliser l'email
  const normalizedEmail = email.trim().toLowerCase();

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    console.error(`❌ Un utilisateur avec l'email ${normalizedEmail} existe déjà`);
    console.log("\nPour promouvoir cet utilisateur au rôle ADMIN, utilisez :");
    console.log(`  pnpm admin:create --email ${normalizedEmail}`);
    console.log("\nPour définir son mot de passe, utilisez :");
    console.log(`  pnpm admin:set-password --email ${normalizedEmail} "<password>"`);
    process.exit(1);
  }

  // Vérifier si le username est déjà utilisé (si fourni)
  if (username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      console.error(`❌ Le nom d'utilisateur "${username}" est déjà utilisé`);
      process.exit(1);
    }
  }

  // Hasher le mot de passe avec bcrypt (10 rounds)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Créer l'utilisateur admin
  const newAdmin = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: username || null,
      password: hashedPassword,
      role: "ADMIN",
      isPremium: true, // Les admins sont automatiquement premium
    },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      role: true,
      isPremium: true,
      createdAt: true,
    },
  });

  console.log("✅ Administrateur créé avec succès !");
  console.log("\nDétails de l'administrateur :");
  console.log(`   ID: ${newAdmin.id}`);
  console.log(`   Email: ${newAdmin.email}`);
  console.log(`   Username: ${newAdmin.username || "N/A"}`);
  console.log(`   Phone: ${newAdmin.phone || "N/A"}`);
  console.log(`   Role: ${newAdmin.role}`);
  console.log(`   Premium: ${newAdmin.isPremium ? "Oui" : "Non"}`);
  console.log(`   Créé le: ${newAdmin.createdAt.toISOString()}`);
  console.log("\n✅ L'administrateur peut maintenant se connecter avec :");
  console.log(`   Email: ${newAdmin.email}`);
  console.log(`   Mot de passe: [le mot de passe que vous avez fourni]`);
  console.log("\nRoute de connexion : POST /api/admin/auth/login");
  console.log("\nExemple de requête :");
  console.log(`curl -X POST http://localhost:3000/api/admin/auth/login \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"email":"${newAdmin.email}","password":"${password}"}'`);
}

createAdminComplete()
  .catch((error) => {
    console.error("❌ Erreur lors de la création de l'administrateur :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

