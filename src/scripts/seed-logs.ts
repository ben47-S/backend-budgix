/**
 * Script de test pour créer des logs de test dans la base de données
 * 
 * Usage: npx ts-node src/scripts/seed-logs.ts
 */

import { logEvent } from "../services/log.service.js"
import logger from "../lib/logger.js"

async function seedLogs() {
  logger.info("Démarrage du seeding des logs de test...")

  const testLogs = [
    {
      level: "INFO" as const,
      scope: "SECURITY" as const,
      action: "USER_LOGIN_SUCCESS",
      userId: "user_test_001",
      metadata: { ip: "192.168.1.100", device: "iPhone 14" },
    },
    {
      level: "WARN" as const,
      scope: "SECURITY" as const,
      action: "USER_LOGIN_FAILED",
      userId: "user_test_002",
      metadata: { reason: "INVALID_PASSWORD", attempts: 2 },
    },
    {
      level: "INFO" as const,
      scope: "BUSINESS" as const,
      action: "TRANSACTION_CREATED",
      userId: "user_test_001",
      targetId: "txn_test_001",
      metadata: { amount: 150.5, category: "Alimentation", type: "EXPENSE" },
    },
    {
      level: "INFO" as const,
      scope: "ADMIN" as const,
      action: "CATEGORY_CREATED",
      adminId: "admin_test_001",
      targetId: "cat_test_001",
      metadata: { name: "Test Category", type: "EXPENSE" },
    },
    {
      level: "ERROR" as const,
      scope: "SYSTEM" as const,
      action: "DATABASE_CONNECTION_FAILED",
      metadata: { error: "Connection timeout", retryAttempt: 1 },
    },
    {
      level: "INFO" as const,
      scope: "BUSINESS" as const,
      action: "BUDGET_CREATED",
      userId: "user_test_001",
      targetId: "bdg_test_001",
      metadata: { amount: 500, period: "MONTHLY", category: "Transport" },
    },
    {
      level: "INFO" as const,
      scope: "USER" as const,
      action: "PROFILE_UPDATED",
      userId: "user_test_001",
      metadata: { fields: ["email", "username"] },
    },
    {
      level: "WARN" as const,
      scope: "BUSINESS" as const,
      action: "BUDGET_EXCEEDED",
      userId: "user_test_002",
      targetId: "bdg_test_002",
      metadata: { budgetAmount: 300, spentAmount: 350, overage: 50 },
    },
  ]

  logger.info(`Création de ${testLogs.length} logs de test...`)

  for (const logData of testLogs) {
    await logEvent(logData)
    // Petit délai pour avoir des timestamps différents
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  logger.info("Seeding des logs terminé avec succès !")
  logger.info("Vous pouvez maintenant vérifier les logs dans le dashboard admin.")
  process.exit(0)
}

// Exécuter le script
seedLogs().catch((error) => {
  logger.error("Erreur lors du seeding des logs:", error)
  process.exit(1)
})
