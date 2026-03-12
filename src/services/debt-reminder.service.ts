/**
 * Service de vérification et d'envoi de rappels de remboursement de créances
 *
 * Ce service vérifie quotidiennement les créances dont la date de remboursement
 * est arrivée et qui ne sont pas encore marquées comme réglées.
 * Il envoie une notification push à l'utilisateur.
 */

import { prisma } from "../lib/prisma.js";
import { sendNotificationToUser } from "./notification.service.js";
import logger from "../lib/logger.js";

/**
 * Vérifie et envoie les rappels de remboursement de créances
 * 
 * Cette fonction est appelée quotidiennement par le cron job
 * Elle vérifie les créances :
 * - OWED_TO_ME (quelqu'un me doit de l'argent)
 * - repaymentDate est passée ou égale à aujourd'hui
 * - isPaid = false
 * - reminderSentAt = null (pas encore envoyé)
 */
export async function checkAndSendDebtReminders(): Promise<void> {
  logger.info('🔄 Vérification des rappels de créances');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Trouver les créances qui ont besoin d'un rappel
  const debts = await prisma.debt.findMany({
    where: {
      // Quelqu'un nous doit de l'argent
      type: 'OWED_TO_ME',
      // Pas encore réglé
      isPaid: false,
      // La date de remboursement est définie
      repaymentDate: {
        not: null,
        lte: today,
      },
      // Pas encore de rappel envoyé
      reminderSentAt: null,
    },
    select: {
      id: true,
      contactName: true,
      amount: true,
      userId: true,
    },
  });

  if (debts.length === 0) {
    logger.info('✅ Aucun rappel de créance à envoyer');
    return;
  }

  logger.info(`📋 ${debts.length} créance(s) trouvée(s) pour rappel`);

  // Grouper les créances par utilisateur
  const debtsByUser = new Map<string, typeof debts>();
  
  for (const debt of debts) {
    const userDebts = debtsByUser.get(debt.userId) || [];
    userDebts.push(debt);
    debtsByUser.set(debt.userId, userDebts);
  }

  // Envoyer les notifications par utilisateur
  for (const [userId, userDebts] of debtsByUser) {
    try {
      // Formater le montant
      const amounts = userDebts.map(d => {
        const amount = Number(d.amount);
        return amount.toLocaleString('fr-FR') + ' FCA';
      });

      let body: string;
      const firstDebt = userDebts[0];
      if (!firstDebt) {
        continue;
      }
      
      if (userDebts.length === 1) {
        body = `${firstDebt.contactName} doit vous rendre ${amounts[0]} aujourd'hui`;
      } else {
        const totalAmount = userDebts.reduce((sum, d) => sum + Number(d.amount), 0);
        const total = totalAmount.toLocaleString('fr-FR') + ' FCA';
        const names = userDebts.map(d => d.contactName).join(', ');
        body = `${names} doivent vous rendre ${total} aujourd'hui`;
      }

      // Envoyer la notification
      const result = await sendNotificationToUser(
        userId,
        'Rappel de remboursement',
        body,
        { type: 'DEBT_REMINDER' },
        false, // requireBudgetAlerts
        true,   // requireReminders
        false   // requireSubscriptionReminders
      );

      if (result.sent) {
        // Marquer les créances comme ayant reçu un rappel
        await prisma.debt.updateMany({
          where: {
            id: { in: userDebts.map(d => d.id) },
          },
          data: {
            reminderSentAt: new Date(),
          },
        });

        logger.info(`✅ Rappel de créance envoyé à l'utilisateur ${userId}`, {
          debtCount: userDebts.length,
        });
      } else {
        logger.warn(`⚠️ Échec de l'envoi du rappel à l'utilisateur ${userId}`, {
          reason: 'reason' in result ? result.reason : 'Erreur inconnue',
        });
      }
    } catch (error) {
      logger.error(`❌ Erreur lors de l'envoi du rappel à l'utilisateur ${userId}`, {
        error,
      });
    }
  }

  logger.info('✅ Vérification des rappels de créances terminée');
}
