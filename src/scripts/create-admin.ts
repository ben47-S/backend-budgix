/**
 * Script pour créer ou promouvoir un utilisateur au rôle ADMIN
 * 
 * Usage:
 *   pnpm tsx src/scripts/create-admin.ts <userId>
 *   ou
 *   pnpm tsx src/scripts/create-admin.ts --email <email>
 *   ou
 *   pnpm tsx src/scripts/create-admin.ts --phone <phone>
 */

import { prisma } from "../lib/prisma";

async function createAdmin() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ Erreur : Vous devez fournir un ID utilisateur, un email ou un numéro de téléphone");
    console.log("\nUsage:");
    console.log("  pnpm tsx src/scripts/create-admin.ts <userId>");
    console.log("  pnpm tsx src/scripts/create-admin.ts --email <email>");
    console.log("  pnpm tsx src/scripts/create-admin.ts --phone <phone>");
    process.exit(1);
  }

  let user;

  // Vérifier si c'est un email ou un phone avec flag
  if (args[0] === "--email" && args[1]) {
    const email = args[1];
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email : ${email}`);
      process.exit(1);
    }
  } else if (args[0] === "--phone" && args[1]) {
    const phone = args[1];
    user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec le téléphone : ${phone}`);
      process.exit(1);
    }
  } else {
    // Sinon, traiter comme un ID utilisateur
    const userId = args[0];
    if (!userId) {
      console.error("❌ ID utilisateur manquant");
      process.exit(1);
    }
    // TypeScript a besoin d'une assertion explicite après la vérification
    user = await prisma.user.findUnique({
      where: { id: userId as string },
    });

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'ID : ${userId}`);
      process.exit(1);
    }
  }

  // Vérifier si l'utilisateur est déjà admin
  if (user.role === "ADMIN") {
    console.log(`✅ L'utilisateur est déjà administrateur :`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email || "N/A"}`);
    console.log(`   Phone: ${user.phone || "N/A"}`);
    console.log(`   Username: ${user.username || "N/A"}`);
    process.exit(0);
  }

  // Promouvoir l'utilisateur au rôle ADMIN
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
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

  console.log("✅ Utilisateur promu au rôle ADMIN avec succès !");
  console.log("\nDétails de l'utilisateur :");
  console.log(`   ID: ${updatedUser.id}`);
  console.log(`   Email: ${updatedUser.email || "N/A"}`);
  console.log(`   Phone: ${updatedUser.phone || "N/A"}`);
  console.log(`   Username: ${updatedUser.username || "N/A"}`);
  console.log(`   Role: ${updatedUser.role}`);
  console.log(`   Premium: ${updatedUser.isPremium ? "Oui" : "Non"}`);
  console.log(`   Créé le: ${updatedUser.createdAt.toISOString()}`);
  console.log("\n⚠️  Important : L'utilisateur doit se reconnecter pour obtenir un nouveau token avec le rôle ADMIN.");
}

createAdmin()
  .catch((error) => {
    console.error("❌ Erreur lors de la promotion de l'utilisateur :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

