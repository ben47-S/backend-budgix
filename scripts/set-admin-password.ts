/**
 * Script pour définir le mot de passe d'un administrateur
 * Usage: tsx scripts/set-admin-password.ts <email> <password>
 * Exemple: tsx scripts/set-admin-password.ts admin@budgix.com MyPassword123
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

async function setAdminPassword(email: string, password: string) {
  try {
    console.log(`🔍 Recherche de l'administrateur avec l'email: ${email}`);

    // Récupérer l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });

    // Vérifier que l'utilisateur existe
    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      console.log(`\n💡 Astuce: Vérifiez que l'email est correct dans la base de données`);
      process.exit(1);
    }

    // Vérifier que l'utilisateur a le rôle ADMIN
    if (user.role !== "ADMIN") {
      console.error(`❌ L'utilisateur ${email} n'est pas un administrateur (rôle: ${user.role})`);
      console.log(`\n💡 Astuce: Ce script ne peut modifier que des comptes ADMIN`);
      process.exit(1);
    }

    console.log(`✅ Administrateur trouvé:`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Username: ${user.username || "N/A"}`);
    console.log(`   - Role: ${user.role}`);

    // Vérifier la longueur du mot de passe
    if (password.length < 8) {
      console.error(`❌ Le mot de passe doit contenir au moins 8 caractères`);
      process.exit(1);
    }

    console.log(`\n🔐 Hachage du mot de passe...`);

    // Hasher le mot de passe avec bcrypt (10 rounds)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log(`💾 Mise à jour du mot de passe dans la base de données...`);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    console.log(`\n✅ Mot de passe mis à jour avec succès pour ${email}`);
    console.log(`\n🚀 Vous pouvez maintenant vous connecter avec:`);
    console.log(`   - Email: ${email}`);
    console.log(`   - Mot de passe: ${password}`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Erreur lors de la mise à jour du mot de passe:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error(`❌ Usage incorrect`);
  console.log(`\n📖 Usage: tsx scripts/set-admin-password.ts <email> <password>`);
  console.log(`📖 Exemple: tsx scripts/set-admin-password.ts admin@budgix.com MyPassword123`);
  process.exit(1);
}

const [email, password] = args;

// Exécuter le script
setAdminPassword(email, password);
