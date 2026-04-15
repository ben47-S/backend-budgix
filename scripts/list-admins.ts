/**
 * Script pour lister tous les administrateurs
 * Usage: tsx scripts/list-admins.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function listAdmins() {
  try {
    console.log(`🔍 Recherche de tous les administrateurs...\n`);

    // Récupérer tous les utilisateurs avec le rôle ADMIN
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        password: true, // Juste pour vérifier s'il est défini
        isPremium: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (admins.length === 0) {
      console.log(`❌ Aucun administrateur trouvé dans la base de données`);
      console.log(`\n💡 Astuce: Créez un administrateur dans la base de données avec le rôle ADMIN`);
      process.exit(0);
    }

    console.log(`✅ ${admins.length} administrateur(s) trouvé(s):\n`);

    admins.forEach((admin, index) => {
      console.log(`${index + 1}. Administrateur:`);
      console.log(`   - ID: ${admin.id}`);
      console.log(`   - Email: ${admin.email || "N/A"}`);
      console.log(`   - Phone: ${admin.phone || "N/A"}`);
      console.log(`   - Username: ${admin.username || "N/A"}`);
      console.log(`   - Mot de passe défini: ${admin.password ? "✅ OUI" : "❌ NON"}`);
      console.log(`   - Premium: ${admin.isPremium ? "✅" : "❌"}`);
      console.log(`   - Créé le: ${admin.createdAt.toISOString()}`);
      console.log(``);
    });

    console.log(`\n💡 Pour définir le mot de passe d'un admin, utilisez:`);
    console.log(`   tsx scripts/set-admin-password.ts <email> <password>`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Erreur lors de la récupération des administrateurs:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
listAdmins();
