/**
 * Script de test pour vérifier si le token LeTexto est valide
 *
 * Usage: node test-letexto-token.js
 */

import 'dotenv/config';

const LETEXTO_API_TOKEN = process.env.LETEXTO_API_TOKEN;
const LETEXTO_API_URL = "https://apis.letexto.com/v1";

console.log("\n🔍 Test de validation du token LeTexto\n");
console.log("Token utilisé:", LETEXTO_API_TOKEN ? `${LETEXTO_API_TOKEN.substring(0, 8)}...${LETEXTO_API_TOKEN.substring(LETEXTO_API_TOKEN.length - 4)}` : "NON CONFIGURÉ");
console.log("URL API:", LETEXTO_API_URL);
console.log("\n" + "=".repeat(60) + "\n");

if (!LETEXTO_API_TOKEN) {
  console.error("❌ ERREUR: LETEXTO_API_TOKEN n'est pas configuré dans le .env");
  process.exit(1);
}

// Test 1: Vérifier le solde (méthode GET avec token en query param)
console.log("📊 Test 1: Vérification du solde...\n");

try {
  const balanceUrl = `${LETEXTO_API_URL}/users/balance?token=${LETEXTO_API_TOKEN}`;

  const balanceResponse = await fetch(balanceUrl);
  const balanceData = await balanceResponse.json();

  console.log("Status:", balanceResponse.status, balanceResponse.statusText);
  console.log("Réponse:", JSON.stringify(balanceData, null, 2));

  if (balanceResponse.ok) {
    console.log("\n✅ Token valide ! Solde:", balanceData.balance, "crédits SMS");
  } else {
    console.log("\n❌ Token invalide ou erreur API");
    console.log("Message d'erreur:", balanceData.message || balanceData.error);
  }
} catch (error) {
  console.error("\n❌ Erreur lors de l'appel API:", error.message);
}

console.log("\n" + "=".repeat(60) + "\n");

// Test 2: Vérifier avec une requête d'envoi de SMS (sans vraiment envoyer)
console.log("📤 Test 2: Test d'authentification pour envoi de SMS...\n");

try {
  const sendUrl = `${LETEXTO_API_URL}/messages/send`;

  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LETEXTO_API_TOKEN}`,
    },
    body: JSON.stringify({
      from: "Budgix",
      to: "2250000000000", // Numéro invalide pour ne pas envoyer vraiment
      content: "Test",
    }),
  });

  const sendData = await sendResponse.json();

  console.log("Status:", sendResponse.status, sendResponse.statusText);
  console.log("Réponse:", JSON.stringify(sendData, null, 2));

  if (sendResponse.status === 401) {
    console.log("\n❌ Token rejeté - Authentification échouée");
    console.log("\n💡 Action requise:");
    console.log("   1. Connecte-toi sur https://letexto.com");
    console.log("   2. Va dans la section API/Développeur");
    console.log("   3. Vérifie ou génère un nouveau token");
    console.log("   4. Remplace LETEXTO_API_TOKEN dans le fichier .env");
    console.log("   5. Relance ce script pour vérifier");
  } else if (sendResponse.status === 400) {
    // Erreur 400 = token valide mais paramètres invalides (ce qui est attendu avec un faux numéro)
    console.log("\n✅ Token valide ! (Erreur 400 attendue car numéro de test invalide)");
  } else {
    console.log("\n⚠️ Réponse inattendue - Vérifiez manuellement");
  }
} catch (error) {
  console.error("\n❌ Erreur lors de l'appel API:", error.message);
}

console.log("\n" + "=".repeat(60) + "\n");
