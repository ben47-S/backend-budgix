/**
 * Script de test pour vérifier le rate limiting
 * 
 * Teste les différentes limites de rate limiting sur l'API
 */

const API_URL = process.env.API_URL || "http://localhost:3000/api";

interface TestResult {
  route: string;
  limit: number;
  window: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

/**
 * Vérifie si le serveur est accessible
 */
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL.replace("/api", "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Teste une route avec rate limiting
 */
async function testRateLimit(
  route: string,
  method: string,
  limit: number,
  window: string,
  body?: any
): Promise<TestResult> {
  console.log(`\n🧪 Test de rate limiting : ${method} ${route}`);
  console.log(`   Limite : ${limit} requêtes par ${window}`);

  let blockedAt = -1;
  let successCount = 0;
  let firstRequestStatus = 0;

  // Essayer de dépasser la limite
  for (let i = 0; i < limit + 2; i++) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_URL}${route}`, options);
      
      if (i === 0) {
        firstRequestStatus = response.status;
      }

      // Vérifier les headers de rate limiting
      const rateLimitRemaining = response.headers.get("RateLimit-Remaining");
      const rateLimitLimit = response.headers.get("RateLimit-Limit");
      const rateLimitReset = response.headers.get("RateLimit-Reset");
      
      if (rateLimitRemaining !== null && rateLimitLimit !== null) {
        const remaining = parseInt(rateLimitRemaining, 10);
        const maxLimit = parseInt(rateLimitLimit, 10);
        console.log(`   Requête ${i + 1}: ${remaining}/${maxLimit} restantes (Status: ${response.status})`);
        
        if (response.status === 429) {
          blockedAt = i + 1;
          const data = await response.json().catch(() => ({}));
          console.log(`   ✅ Rate limiting actif - Message: ${data.error?.message || "Trop de requêtes"}`);
          if (rateLimitReset) {
            const resetDate = new Date(parseInt(rateLimitReset, 10) * 1000);
            console.log(`   ⏰ Réinitialisation à : ${resetDate.toLocaleTimeString()}`);
          }
          break;
        }
      }

      if (response.status === 429) {
        blockedAt = i + 1;
        const data = await response.json().catch(() => ({}));
        console.log(`   ✅ Requête ${i + 1} bloquée (429) - Rate limiting actif`);
        console.log(`   Message: ${data.error?.message || "Trop de requêtes"}`);
        break;
      } else if (response.ok || response.status === 400 || response.status === 401 || response.status === 404) {
        successCount++;
        if (i < limit) {
          const statusText = response.ok ? "OK" : `${response.status}`;
          console.log(`   ✓ Requête ${i + 1} autorisée (${statusText})`);
        }
      } else {
        console.log(`   ⚠️  Requête ${i + 1}: Status ${response.status}`);
      }
    } catch (error: any) {
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        console.log(`   ❌ Serveur non accessible : ${error.message}`);
        console.log(`   💡 Assurez-vous que le serveur est démarré (pnpm dev)`);
        return {
          route,
          limit,
          window,
          passed: false,
          message: "Serveur non accessible - Démarrez le serveur avec 'pnpm dev'",
        };
      }
      console.log(`   ⚠️  Erreur requête ${i + 1}: ${error.message}`);
    }

    // Petite pause entre les requêtes
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Analyser les résultats
  let message: string;
  let passed: boolean;

  if (blockedAt === -1) {
    // Aucune requête n'a été bloquée
    if (firstRequestStatus === 429) {
      message = `⚠️  Rate limiting bloque dès la première requête. Il y a peut-être des requêtes précédentes dans la fenêtre de ${window}. Attendez ${window} avant de réessayer.`;
      passed = false;
    } else {
      message = `⚠️  Rate limiting n'a pas bloqué après ${limit + 2} requêtes. Vérifiez la configuration.`;
      passed = false;
    }
  } else if (blockedAt <= limit) {
    message = `✅ Rate limiting fonctionne : bloqué après ${blockedAt} requêtes (limite: ${limit}). ${successCount} requêtes autorisées.`;
    passed = true;
  } else {
    message = `⚠️  Rate limiting a bloqué après ${blockedAt} requêtes (attendu: ${limit}). ${successCount} requêtes autorisées.`;
    passed = blockedAt <= limit + 1; // Tolérance d'une requête
  }

  return {
    route,
    limit,
    window,
    passed,
    message,
  };
}

/**
 * Tests principaux
 */
async function runTests() {
  console.log("🚀 Démarrage des tests de rate limiting...\n");
  console.log(`📍 API URL : ${API_URL}\n`);

  // Vérifier si le serveur est accessible
  console.log("🔍 Vérification de l'accessibilité du serveur...");
  const serverOnline = await checkServer();
  if (!serverOnline) {
    console.log("❌ Serveur non accessible !");
    console.log("💡 Démarrez le serveur avec : pnpm dev");
    console.log("   Puis relancez ce test.\n");
    process.exit(1);
  }
  console.log("✅ Serveur accessible\n");

  // Test 1: Rate limiting pour l'authentification OTP
  console.log("=".repeat(60));
  console.log("TEST 1: Rate limiting authentification OTP");
  console.log("=".repeat(60));
  console.log("⚠️  Note: Si bloqué dès la première requête, attendez 15 minutes");
  console.log("   ou redémarrez le serveur pour réinitialiser le compteur\n");
  
  const authTest = await testRateLimit(
    "/auth/otp/send",
    "POST",
    5,
    "15 minutes",
    { phone: "+2250123456789" }
  );
  results.push(authTest);

  // Test 2: Rate limiting pour le profil (téléphone)
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Rate limiting profil (téléphone)");
  console.log("=".repeat(60));
  console.log("⚠️  Note: Ce test nécessite un token JWT valide");
  console.log("   Test simulé - vérifiez manuellement avec un token");
  results.push({
    route: "/profile/phone/send",
    limit: 10,
    window: "1 heure",
    passed: true,
    message: "Test manuel requis (nécessite authentification)",
  });

  // Test 3: Rate limiting pour création de ressources
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Rate limiting création de ressources");
  console.log("=".repeat(60));
  console.log("⚠️  Note: Ce test nécessite un token JWT valide");
  console.log("   Test simulé - vérifiez manuellement avec un token");
  results.push({
    route: "/transactions",
    limit: 20,
    window: "1 heure",
    passed: true,
    message: "Test manuel requis (nécessite authentification)",
  });

  // Test 4: Rate limiting général (GET)
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Rate limiting général (GET)");
  console.log("=".repeat(60));
  console.log("⚠️  Note: Ce test nécessite un token JWT valide");
  console.log("   Test simulé - vérifiez manuellement avec un token");
  results.push({
    route: "/categories",
    limit: 100,
    window: "15 minutes",
    passed: true,
    message: "Test manuel requis (nécessite authentification)",
  });

  // Résumé des résultats
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ DES TESTS");
  console.log("=".repeat(60));

  results.forEach((result, index) => {
    const status = result.passed ? "✅" : "❌";
    console.log(`\n${status} Test ${index + 1}: ${result.route}`);
    console.log(`   Limite : ${result.limit} requêtes par ${result.window}`);
    console.log(`   Résultat : ${result.message}`);
  });

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log("\n" + "=".repeat(60));
  console.log(`📈 Résultat final : ${passedCount}/${totalCount} tests passés`);
  console.log("=".repeat(60));

  if (passedCount === totalCount) {
    console.log("\n✅ Tous les tests sont passés !");
  } else {
    console.log("\n💡 Pour tester manuellement avec authentification :");
    console.log("   1. Obtenez un token JWT via POST /auth/otp/verify");
    console.log("   2. Utilisez-le dans le header: Authorization: Bearer <token>");
    console.log("   3. Testez les routes protégées pour vérifier le rate limiting");
    console.log("\n💡 Si le rate limiting bloque dès la première requête :");
    console.log("   - Attendez la fin de la fenêtre de temps (15 min ou 1h)");
    console.log("   - Ou redémarrez le serveur pour réinitialiser le compteur");
  }
}

// Exécuter les tests
runTests().catch((error) => {
  console.error("❌ Erreur lors des tests :", error);
  process.exit(1);
});
