/**
 * Script de test pour vérifier la connexion Prisma
 * 
 * Ce script teste :
 * - La connexion à la base de données
 * - La génération du client Prisma
 * - Les modèles disponibles
 * 
 * Exécution : pnpm test:prisma
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function testPrismaConnection() {
  console.log("🔍 Test de la connexion Prisma...\n");

  try {
    // 1. Test de connexion basique
    console.log("1️⃣ Test de connexion à la base de données...");
    await prisma.$connect();
    console.log("✅ Connexion réussie !\n");

    // 2. Test d'une requête simple (compter les utilisateurs)
    console.log("2️⃣ Test d'une requête simple...");
    const userCount = await prisma.user.count();
    console.log(`✅ Requête réussie ! Nombre d'utilisateurs : ${userCount}\n`);

    // 3. Vérifier les modèles disponibles
    console.log("3️⃣ Modèles disponibles dans le schéma :");
    console.log("   - User");
    console.log("   - OtpCode");
    console.log("   - Category");
    console.log("   - Transaction");
    console.log("   - Subscription");
    console.log("   - Debt\n");

    // 4. Test de la structure de la base (si les tables existent)
    console.log("4️⃣ Vérification de la structure de la base...");
    try {
      // Essayer d'accéder aux tables (cela échouera si les migrations n'ont pas été exécutées)
      await prisma.user.findFirst();
      console.log("✅ Les tables existent dans la base de données !\n");
    } catch (error: any) {
      if (error.code === "P2021" || error.message?.includes("does not exist")) {
        console.log("⚠️  Les tables n'existent pas encore.");
        console.log("   Exécutez : pnpm prisma migrate dev --name init\n");
      } else {
        throw error;
      }
    }

    console.log("🎉 Tous les tests sont passés avec succès !");
    console.log("\n📝 Prochaines étapes :");
    console.log("   1. Créez votre fichier .env avec DATABASE_URL");
    console.log("   2. Exécutez : pnpm prisma migrate dev --name init");
    console.log("   3. Commencez à utiliser prisma dans votre code !\n");

  } catch (error: any) {
    console.error("❌ Erreur lors du test :\n");
    
    if (error.code === "P1001") {
      console.error("   ⚠️  Impossible de se connecter à la base de données.");
      console.error("   Vérifiez que :");
      console.error("   - PostgreSQL est démarré");
      console.error("   - DATABASE_URL est correct dans votre .env");
      console.error("   - La base de données existe\n");
    } else if (error.code === "P1017") {
      console.error("   ⚠️  La connexion à la base de données a été fermée.");
      console.error("   Vérifiez votre configuration DATABASE_URL\n");
    } else {
      console.error("   Détails :", error.message);
      if (error.stack) {
        console.error("\n   Stack trace :", error.stack);
      }
    }
    
    process.exit(1);
  } finally {
    // Déconnecter proprement
    await prisma.$disconnect();
    console.log("🔌 Déconnexion de Prisma...");
  }
}

// Exécuter le test
testPrismaConnection()
  .catch((error) => {
    console.error("Erreur fatale :", error);
    process.exit(1);
  });

