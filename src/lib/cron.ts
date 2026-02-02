/**
 * Configuration des tâches cron
 * 
 * Ce fichier configure les tâches planifiées qui s'exécutent automatiquement :
 * - Vérification quotidienne des renouvellements d'abonnements externes (9h00 UTC)
 */

import cron from "node-cron";
import { checkAndSendRenewalReminders } from "../services/subscription-reminder.service";
import { cleanupInactiveDiscussions } from "../services/discussion.service";
import logger from "./logger";

/**
 * Démarre toutes les tâches cron
 */
export function startCronJobs() {
  logger.info("⏰ Initialisation des tâches cron...");

  // Tâche quotidienne à 9h00 UTC pour vérifier les renouvellements d'abonnements
  // Format cron: "0 9 * * *" = chaque jour à 9h00 UTC
  cron.schedule("0 9 * * *", async () => {
    logger.info("🔔 Exécution de la tâche cron: vérification des renouvellements d'abonnements");
    
    try {
      const result = await checkAndSendRenewalReminders();
      logger.info("✅ Tâche cron terminée avec succès", result);
    } catch (error) {
      logger.error("❌ Erreur lors de l'exécution de la tâche cron", {
        error: error instanceof Error ? error.message : "Erreur inconnue",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, {
    timezone: "UTC",
  });

  // Tâche toutes les 5 minutes pour nettoyer les discussions inactives (25 minutes d'inactivité)
  // Format cron: "*/5 * * * *" = toutes les 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    logger.info("🧹 Exécution de la tâche cron: nettoyage des discussions inactives");
    
    try {
      const result = await cleanupInactiveDiscussions();
      if (result.deletedCount > 0) {
        logger.info(`✅ ${result.deletedCount} discussion(s) inactive(s) supprimée(s)`);
      }
    } catch (error) {
      logger.error("❌ Erreur lors du nettoyage des discussions inactives", {
        error: error instanceof Error ? error.message : "Erreur inconnue",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  logger.info("✅ Tâches cron initialisées");
  logger.info("  - Vérification des renouvellements: chaque jour à 9h00 UTC");
  logger.info("  - Nettoyage des discussions inactives: toutes les 5 minutes");
}

