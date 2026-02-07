/**
 * Service de vérification et d'envoi de notifications de renouvellement d'abonnements externes
 * 
 * Ce service vérifie quotidiennement les abonnements qui doivent être renouvelés
 * et envoie des notifications push aux utilisateurs :
 * - 5 jours avant le renouvellement pour les abonnements MONTHLY, QUARTERLY, ANNUAL
 * - Désactive automatiquement les abonnements expirés
 */

import { prisma } from "../lib/prisma";
import { sendSubscriptionRenewalReminder } from "./notification.service";
import logger from "../lib/logger";

/**
 * Calcule le nombre de jours entre deux dates
 * 
 * @param date1 - Première date
 * @param date2 - Deuxième date
 * @returns Nombre de jours entre les deux dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // heures * minutes * secondes * millisecondes
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / oneDay);
}

/**
 * Désactive automatiquement les abonnements expirés
 * 
 * @returns Nombre d'abonnements désactivés
 */
export async function deactivateExpiredSubscriptions(): Promise<number> {
  logger.info('🔄 Vérification des abonnements expirés');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure

  const result = await prisma.externalSubscription.updateMany({
    where: {
      isActive: true,
      nextBillingDate: {
        lt: today,
      },
    },
    data: {
      isActive: false,
    },
  });

  logger.info('✅ Abonnements expirés désactivés', {
    count: result.count,
  });

  return result.count;
}

/**
 * Vérifie et envoie les notifications de renouvellement pour tous les utilisateurs
 * 
 * Cette fonction doit être appelée quotidiennement (via un cron job) à 9h00 UTC
 * Envoie une notification 5 jours avant le renouvellement pour les abonnements MONTHLY, QUARTERLY, ANNUAL
 */
export async function checkAndSendRenewalReminders() {
  logger.info('🔔 Démarrage de la vérification des renouvellements d\'abonnements');

  // D'abord, désactiver les abonnements expirés
  await deactivateExpiredSubscriptions();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure

  // Calculer la date dans exactement 5 jours
  const fiveDaysLater = new Date(today);
  fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);

  // Récupérer tous les abonnements actifs dont la date de renouvellement est dans exactement 5 jours
  // Tous les cycles de facturation (MONTHLY, QUARTERLY, ANNUAL, CUSTOM)
  const subscriptions = await prisma.externalSubscription.findMany({
    where: {
      isActive: true,
      nextBillingDate: {
        gte: today,
        lte: fiveDaysLater,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          isPremium: true,
        },
      },
    },
  });

  logger.info('📊 Abonnements à vérifier', {
    count: subscriptions.length,
    dateRange: {
      from: today.toISOString(),
      to: fiveDaysLater.toISOString(),
    },
  });

  let notificationsSent = 0;
  let errors = 0;

  for (const subscription of subscriptions) {
    try {
      // Vérifier que l'utilisateur est toujours premium
      if (!subscription.user.isPremium) {
        logger.debug('⏭️ Utilisateur non premium, notification ignorée', {
          subscriptionId: subscription.id,
          userId: subscription.userId,
        });
        continue;
      }

      const nextBillingDate = new Date(subscription.nextBillingDate);
      const nextBillingDateOnly = new Date(
        nextBillingDate.getFullYear(),
        nextBillingDate.getMonth(),
        nextBillingDate.getDate()
      );

      const daysUntilRenewal = daysBetween(today, nextBillingDateOnly);

      // Envoyer une notification seulement si c'est exactement dans 5 jours
      if (daysUntilRenewal === 5) {
        logger.info('📨 Envoi de notification de renouvellement', {
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          userId: subscription.userId,
          daysUntilRenewal,
          nextBillingDate: nextBillingDate.toISOString(),
        });

        // Vérifier si une notification a déjà été envoyée pour cet abonnement
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: subscription.userId,
            type: 'SUBSCRIPTION_RENEWAL_REMINDER',
            data: {
              path: ['subscriptionId'],
              equals: subscription.id,
            },
            createdAt: {
              gte: new Date(today.getTime() - 24 * 60 * 60 * 1000), // Dans les dernières 24h
            },
          },
        });

        if (existingNotification) {
          logger.debug('⏭️ Notification déjà envoyée récemment', {
            subscriptionId: subscription.id,
            userId: subscription.userId,
          });
          continue;
        }

        const result = await sendSubscriptionRenewalReminder(
          subscription.userId,
          subscription.id,
          subscription.name,
          subscription.amount,
          nextBillingDate,
          daysUntilRenewal
        );

        if (result.sent) {
          notificationsSent++;
          logger.info('✅ Notification envoyée avec succès', {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            daysUntilRenewal,
          });
        } else {
          errors++;
          logger.warn('⚠️ Notification non envoyée', {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            reason: result.reason,
          });
        }
      }
    } catch (error) {
      errors++;
      logger.error('❌ Erreur lors de l\'envoi de notification de renouvellement', {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  logger.info('✅ Vérification des renouvellements terminée', {
    totalSubscriptions: subscriptions.length,
    notificationsSent,
    errors,
  });

  return {
    totalSubscriptions: subscriptions.length,
    notificationsSent,
    errors,
  };
}

/**
 * Vérifie et envoie les notifications de renouvellement pour un utilisateur spécifique
 * 
 * @param userId - ID de l'utilisateur
 */
export async function checkAndSendRenewalRemindersForUser(userId: string) {
  logger.info('🔔 Vérification des renouvellements pour un utilisateur', { userId });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fiveDaysLater = new Date(today);
  fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);

  const subscriptions = await prisma.externalSubscription.findMany({
    where: {
      userId,
      isActive: true,
      nextBillingDate: {
        gte: today,
        lte: fiveDaysLater,
      },
    },
  });

  let notificationsSent = 0;

  for (const subscription of subscriptions) {
    try {
      const nextBillingDate = new Date(subscription.nextBillingDate);
      const nextBillingDateOnly = new Date(
        nextBillingDate.getFullYear(),
        nextBillingDate.getMonth(),
        nextBillingDate.getDate()
      );

      const daysUntilRenewal = daysBetween(today, nextBillingDateOnly);

      if (daysUntilRenewal === 5) {
        // Vérifier si une notification a déjà été envoyée
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'SUBSCRIPTION_RENEWAL_REMINDER',
            data: {
              path: ['subscriptionId'],
              equals: subscription.id,
            },
            createdAt: {
              gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existingNotification) {
          continue;
        }

        const result = await sendSubscriptionRenewalReminder(
          userId,
          subscription.id,
          subscription.name,
          subscription.amount,
          nextBillingDate,
          daysUntilRenewal
        );

        if (result.sent) {
          notificationsSent++;
        }
      }
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de notification', {
        subscriptionId: subscription.id,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  return { notificationsSent };
}

