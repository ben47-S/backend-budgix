/**
 * Service de vérification et d'envoi de notifications de renouvellement d'abonnements externes
 *
 * Ce service vérifie quotidiennement les abonnements qui doivent être renouvelés
 * et envoie des notifications push aux utilisateurs :
 * - 3 jours avant le renouvellement pour les abonnements MONTHLY, QUARTERLY, ANNUAL
 * - Désactive automatiquement les abonnements expirés
 */

import { prisma } from "../lib/prisma";
import { sendGroupedSubscriptionReminders, sendPremiumSubscriptionRenewalReminder } from "./notification.service";
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
 * Calcule le nombre de jours restants jusqu'à la date de renouvellement
 *
 * @param nextBillingDate - Date du prochain renouvellement
 * @returns Nombre de jours (0 = aujourd'hui, 1 = demain, etc.)
 */
function calculateDaysUntilRenewal(nextBillingDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const billingDate = new Date(nextBillingDate);
  const billingDateOnly = new Date(
    billingDate.getFullYear(),
    billingDate.getMonth(),
    billingDate.getDate()
  );

  return daysBetween(today, billingDateOnly);
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
 * Envoie une notification quotidienne de J-3 à J (jour d'échéance) regroupée par utilisateur
 */
export async function checkAndSendRenewalReminders() {
  logger.info('🔔 Démarrage de la vérification des renouvellements d\'abonnements');

  // D'abord, désactiver les abonnements expirés
  const deactivatedCount = await deactivateExpiredSubscriptions();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure

  // Calculer la fenêtre J-3 à J (4 jours au total)
  const fourDaysLater = new Date(today);
  fourDaysLater.setDate(fourDaysLater.getDate() + 4);

  // Récupérer TOUS les abonnements actifs qui expirent dans les 3 prochains jours OU aujourd'hui
  const subscriptions = await prisma.externalSubscription.findMany({
    where: {
      isActive: true,
      nextBillingDate: {
        gte: today,        // À partir d'aujourd'hui (inclut J)
        lt: fourDaysLater,  // Jusqu'à J+3 (exclut J+4)
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
      to: fourDaysLater.toISOString(),
    },
  });

  // Grouper les abonnements par utilisateur
  const subscriptionsByUser = new Map<string, typeof subscriptions>();

  for (const subscription of subscriptions) {
    const userId = subscription.userId;
    if (!subscriptionsByUser.has(userId)) {
      subscriptionsByUser.set(userId, []);
    }
    subscriptionsByUser.get(userId)!.push(subscription);
  }

  let notificationsSent = 0;
  let skippedUsers = 0;
  let errors = 0;

  // Traiter par utilisateur (une notification par utilisateur)
  for (const [userId, userSubscriptions] of subscriptionsByUser.entries()) {
    try {
      const user = userSubscriptions[0]!.user; // Safe car au moins 1 abonnement par utilisateur

      // Vérifier que l'utilisateur est toujours premium
      if (!user.isPremium) {
        logger.info('⏭️ Utilisateur non premium, notification ignorée', { userId });
        skippedUsers++;
        continue;
      }

      // Vérifier qu'on n'a pas déjà envoyé dans les dernières 20 heures
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const recentNotification = await prisma.notification.findFirst({
        where: {
          userId: userId,
          type: 'SUBSCRIPTION_RENEWAL_REMINDER',
          createdAt: {
            gte: twentyHoursAgo,
          },
        },
      });

      if (recentNotification) {
        logger.debug('⏭️ Notification déjà envoyée récemment pour l\'utilisateur', { userId });
        skippedUsers++;
        continue;
      }

      // Calculer les jours restants pour chaque abonnement
      const subscriptionsWithDays = userSubscriptions.map(sub => ({
        id: sub.id,
        name: sub.name,
        nextBillingDate: new Date(sub.nextBillingDate),
        daysUntilRenewal: calculateDaysUntilRenewal(sub.nextBillingDate),
      })).filter(sub => sub.daysUntilRenewal >= 0 && sub.daysUntilRenewal <= 3);

      if (subscriptionsWithDays.length === 0) {
        logger.debug('⏭️ Aucun abonnement dans la fenêtre J à J-3', { userId });
        continue;
      }

      // Envoyer UNE notification groupée pour tous les abonnements
      await sendGroupedSubscriptionReminders(userId, subscriptionsWithDays);

      notificationsSent++;
      logger.info('✅ Notification groupée envoyée', {
        userId,
        subscriptionsCount: subscriptionsWithDays.length,
        subscriptions: subscriptionsWithDays.map(s => ({
          name: s.name,
          daysUntilRenewal: s.daysUntilRenewal,
        })),
      });
    } catch (error) {
      errors++;
      logger.error('❌ Erreur lors de l\'envoi de notification pour l\'utilisateur', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  logger.info('✅ Vérification des renouvellements terminée', {
    totalSubscriptions: subscriptions.length,
    totalUsers: subscriptionsByUser.size,
    notificationsSent,
    skippedUsers,
    errors,
    deactivatedCount,
  });

  return {
    totalSubscriptions: subscriptions.length,
    totalUsers: subscriptionsByUser.size,
    notificationsSent,
    skippedUsers,
    errors,
    deactivatedCount,
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

  const fourDaysLater = new Date(today);
  fourDaysLater.setDate(fourDaysLater.getDate() + 4);

  const subscriptions = await prisma.externalSubscription.findMany({
    where: {
      userId,
      isActive: true,
      nextBillingDate: {
        gte: today,
        lt: fourDaysLater,
      },
    },
  });

  // Vérifier qu'on n'a pas déjà envoyé dans les dernières 20 heures
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'SUBSCRIPTION_RENEWAL_REMINDER',
      createdAt: {
        gte: twentyHoursAgo,
      },
    },
  });

  if (existingNotification) {
    logger.debug('⏭️ Notification déjà envoyée récemment', { userId });
    return { notificationsSent: 0 };
  }

  // Calculer les jours restants pour chaque abonnement
  const subscriptionsWithDays = subscriptions.map(sub => ({
    id: sub.id,
    name: sub.name,
    nextBillingDate: new Date(sub.nextBillingDate),
    daysUntilRenewal: calculateDaysUntilRenewal(sub.nextBillingDate),
  })).filter(sub => sub.daysUntilRenewal >= 0 && sub.daysUntilRenewal <= 3);

  if (subscriptionsWithDays.length === 0) {
    logger.debug('⏭️ Aucun abonnement dans la fenêtre J à J-3', { userId });
    return { notificationsSent: 0 };
  }

  try {
    await sendGroupedSubscriptionReminders(userId, subscriptionsWithDays);

    logger.info('✅ Notification groupée envoyée', {
      userId,
      subscriptionsCount: subscriptionsWithDays.length,
    });

    return { notificationsSent: 1 };
  } catch (error) {
    logger.error('❌ Erreur lors de l\'envoi de notification', {
      userId,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    });
    return { notificationsSent: 0 };
  }
}

/**
 * Désactive automatiquement les abonnements premium expirés
 * Met isPremium à false et endDate à null pour marquer comme expiré
 *
 * @returns Nombre d'abonnements désactivés
 */
export async function deactivateExpiredPremiumSubscriptions(): Promise<number> {
  logger.info('🔄 Vérification des abonnements premium expirés');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure

  // Récupérer tous les abonnements premium expirés
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      endDate: {
        lte: today, // endDate <= aujourd'hui
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

  let deactivatedCount = 0;

  // Traiter chaque abonnement expiré
  for (const subscription of expiredSubscriptions) {
    try {
      // Mettre endDate à null et retirer le statut premium
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { endDate: null },
      });

      await prisma.user.update({
        where: { id: subscription.userId },
        data: { isPremium: false },
      });

      deactivatedCount++;
      logger.info('✅ Abonnement premium expiré désactivé', {
        userId: subscription.userId,
        plan: subscription.plan,
        endDate: subscription.endDate,
      });
    } catch (error) {
      logger.error('❌ Erreur lors de la désactivation d\'un abonnement premium', {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  logger.info('✅ Abonnements premium expirés désactivés', {
    count: deactivatedCount,
  });

  return deactivatedCount;
}

/**
 * Vérifie et envoie les notifications de renouvellement pour les abonnements premium
 *
 * Fenêtre de notification: J-3 à J (jour d'échéance)
 * Fréquence: Une fois par jour maximum (fenêtre de 20h entre chaque notification)
 */
export async function checkAndSendPremiumRenewalReminders() {
  logger.info('🔔 Démarrage de la vérification des renouvellements d\'abonnements premium');

  // D'abord, désactiver les abonnements premium expirés
  const deactivatedCount = await deactivateExpiredPremiumSubscriptions();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure

  // Calculer la fenêtre J-3 à J (4 jours au total)
  const fourDaysLater = new Date(today);
  fourDaysLater.setDate(fourDaysLater.getDate() + 4);

  // Récupérer TOUS les abonnements premium qui expirent dans les 3 prochains jours OU aujourd'hui
  const subscriptions = await prisma.subscription.findMany({
    where: {
      endDate: {
        gte: today,        // À partir d'aujourd'hui (inclut J)
        lt: fourDaysLater,  // Jusqu'à J+3 (exclut J+4)
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

  logger.info('📊 Abonnements premium à vérifier', {
    count: subscriptions.length,
    dateRange: {
      from: today.toISOString(),
      to: fourDaysLater.toISOString(),
    },
  });

  let notificationsSent = 0;
  let skippedUsers = 0;
  let errors = 0;

  // Traiter chaque abonnement
  for (const subscription of subscriptions) {
    try {
      const userId = subscription.userId;
      const user = subscription.user;

      // Vérifier que l'utilisateur est toujours premium (sécurité)
      if (!user.isPremium) {
        logger.info('⏭️ Utilisateur non premium, notification ignorée', { userId });
        skippedUsers++;
        continue;
      }

      // Vérifier qu'on n'a pas déjà envoyé dans les dernières 20 heures
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const recentNotification = await prisma.notification.findFirst({
        where: {
          userId: userId,
          type: 'PREMIUM_SUBSCRIPTION_EXPIRATION_REMINDER',
          createdAt: {
            gte: twentyHoursAgo,
          },
        },
      });

      if (recentNotification) {
        logger.debug('⏭️ Notification déjà envoyée récemment pour l\'utilisateur', { userId });
        skippedUsers++;
        continue;
      }

      // Calculer les jours restants
      const daysUntilRenewal = calculateDaysUntilRenewal(subscription.endDate!);

      // Vérifier que l'abonnement est dans la fenêtre J à J-3
      if (daysUntilRenewal < 0 || daysUntilRenewal > 3) {
        logger.debug('⏭️ Abonnement hors fenêtre J à J-3', { userId, daysUntilRenewal });
        continue;
      }

      // Envoyer la notification
      await sendPremiumSubscriptionRenewalReminder(userId, {
        plan: subscription.plan,
        endDate: subscription.endDate!,
        daysUntilRenewal,
      });

      notificationsSent++;
      logger.info('✅ Notification premium envoyée', {
        userId,
        plan: subscription.plan,
        daysUntilRenewal,
      });
    } catch (error) {
      errors++;
      logger.error('❌ Erreur lors de l\'envoi de notification premium', {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  logger.info('✅ Vérification des renouvellements premium terminée', {
    totalSubscriptions: subscriptions.length,
    notificationsSent,
    skippedUsers,
    errors,
    deactivatedCount,
  });

  return {
    totalSubscriptions: subscriptions.length,
    notificationsSent,
    skippedUsers,
    errors,
    deactivatedCount,
  };
}

