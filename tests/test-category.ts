/**
 * Script de test pour créer une catégorie personnalisée
 * 
 * Ce script :
 * 1. Crée un utilisateur (via OTP)
 * 2. Liste les catégories disponibles
 * 3. Crée une catégorie personnalisée pour cet utilisateur
 * 
 * Exécution : pnpm tsx src/test-category.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { createCategory, getCategories } from "../src/services/category.service.js";

const API_URL = process.env.API_URL || "http://localhost:3000";
const TEST_PHONE = process.env.TEST_PHONE || "+2250123456789";

async function createUserViaOTP(): Promise<string> {
  console.log("\n📱 Étape 1 : Création d'un utilisateur via OTP...");

  // 1. Envoyer un OTP
  const sendResponse = await fetch(`${API_URL}/api/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE }),
  });

  const sendData = await sendResponse.json();
  if (!sendData.success) {
    throw new Error(`Erreur lors de l'envoi de l'OTP: ${sendData.error?.message}`);
  }

  console.log("✅ Code OTP envoyé");

  // Récupérer le code (en développement, il est dans la réponse)
  const code = sendData.code || prompt("Entrez le code OTP reçu: ");
  if (!code) {
    throw new Error("Code OTP requis");
  }

  // 2. Vérifier l'OTP
  const verifyResponse = await fetch(`${API_URL}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE, code }),
  });

  const verifyData = await verifyResponse.json();
  if (!verifyData.success || !verifyData.data?.user?.id) {
    throw new Error(`Erreur lors de la vérification: ${verifyData.error?.message}`);
  }

  const userId = verifyData.data.user.id;
  console.log(`✅ Utilisateur créé avec l'ID : ${userId}`);

  return userId;
}

async function getOrCreateUser(): Promise<string> {
  console.log("\n🔍 Vérification si l'utilisateur existe déjà...");

  try {
    // Essayer de trouver l'utilisateur existant
    const user = await prisma.user.findUnique({
      where: { phone: TEST_PHONE },
    });

    if (user) {
      console.log(`✅ Utilisateur trouvé avec l'ID : ${user.id}`);
      return user.id;
    }
  } catch (error) {
    // L'utilisateur n'existe pas, on va le créer
  }

  // Créer un nouvel utilisateur via OTP
  return await createUserViaOTP();
}

async function testCategories(userId: string) {
  console.log("\n📋 Étape 2 : Liste des catégories disponibles...");

  const categories = await getCategories(userId);
  console.log(`✅ ${categories.length} catégorie(s) trouvée(s)`);
  console.log("\nCatégories globales :");
  categories
    .filter((c) => !c.userId)
    .forEach((c) => console.log(`   - ${c.name} (${c.type})`));

  const personalCategories = categories.filter((c) => c.userId);
  if (personalCategories.length > 0) {
    console.log("\nCatégories personnalisées :");
    personalCategories.forEach((c) => console.log(`   - ${c.name} (${c.type})`));
  }

  console.log("\n💡 Étape 3 : Création d'une catégorie personnalisée...");

  const categoryName = "Café";
  const categoryType = "EXPENSE" as const;

  try {
    // Vérifier si la catégorie existe déjà
    const existing = categories.find(
      (c) => c.name === categoryName && c.type === categoryType && c.userId === userId
    );

    if (existing) {
      console.log(`⏭️  La catégorie "${categoryName}" existe déjà pour cet utilisateur`);
      return;
    }

    const newCategory = await createCategory(userId, categoryName, categoryType);
    console.log(`✅ Catégorie "${categoryName}" créée avec succès !`);
    console.log(`   ID: ${newCategory.id}`);
    console.log(`   Type: ${newCategory.type}`);
    console.log(`   UserId: ${newCategory.userId}`);

    // Relister les catégories pour voir la nouvelle
    console.log("\n📋 Liste mise à jour des catégories...");
    const updatedCategories = await getCategories(userId);
    const personalUpdated = updatedCategories.filter((c) => c.userId === userId);
    console.log(`✅ ${personalUpdated.length} catégorie(s) personnalisée(s) au total`);
  } catch (error: any) {
    console.error(`❌ Erreur : ${error.message}`);
  }
}

async function main() {
  console.log("🧪 Test de création de catégorie personnalisée");
  console.log("=".repeat(50));
  console.log(`📍 API URL : ${API_URL}`);
  console.log(`📱 Numéro de test : ${TEST_PHONE}`);

  try {
    // Obtenir ou créer un utilisateur
    const userId = await getOrCreateUser();

    // Tester les catégories
    await testCategories(userId);

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Test terminé avec succès !");
  } catch (error: any) {
    console.error("\n" + "=".repeat(50));
    console.error("❌ Erreur :", error.message);
    console.error("\n💡 Vérifiez que :");
    console.error("   1. Le serveur est démarré (pnpm dev)");
    console.error("   2. La base de données est accessible");
    console.error("   3. Les migrations Prisma ont été exécutées");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Erreur fatale :", error);
  process.exit(1);
});

