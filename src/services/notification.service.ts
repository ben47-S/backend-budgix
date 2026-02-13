/**
 * Service de notifications métier
 * 
 * Ce service gère les différents types de notifications :
 * - Alertes de budget dépassé
 * - Avertissements de budget
 * - Rappels de transaction
 * - Résumés hebdomadaires/mensuels
 */

import { getActivePushTokens } from './pushToken.service';
import { sendExpoPushNotification, checkPushTicketReceipts } from './expo-notification.service';
import { emitToUser } from './websocket.service';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import logger from '../lib/logger';

/**
 * Envoie une notification à un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param title - Titre de la notification
 * @param body - Corps de la notification
 * @param data - Données supplémentaires (optionnel)
 * @param requireBudgetAlerts - Si true, n'envoie qu'aux tokens avec budgetAlerts activé
 * @param requireReminders - Si true, n'envoie qu'aux tokens avec reminders activé
 * @param requireSubscriptionReminders - Si true, n'envoie qu'aux tokens avec subscriptionReminders activé
 * @returns Résultat de l'envoi
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  requireBudgetAlerts: boolean = false,
  requireReminders: boolean = false,
  requireSubscriptionReminders: boolean = false
) {
  // Récupérer les tokens actifs (déjà filtrés par enabled: true)
  logger.debug('🔍 Récupération des tokens push actifs', {
    userId,
    title,
    requireBudgetAlerts,
    requireReminders,
    requireSubscriptionReminders,
  });

  const tokens = await getActivePushTokens(userId);

  logger.info('📱 Tokens actifs récupérés', {
    userId,
    title,
    totalTokens: tokens.length,
    tokens: tokens.map(t => ({
      id: t.id,
      platform: t.platform,
      enabled: t.enabled,
      budgetAlerts: t.budgetAlerts,
      reminders: t.reminders,
      subscriptionReminders: t.subscriptionReminders,
    })),
  });

  // Filtrer selon les préférences spécifiques
  let filteredTokens = tokens;

  if (requireBudgetAlerts) {
    const beforeFilter = filteredTokens.length;
    filteredTokens = filteredTokens.filter(token => token.budgetAlerts);
    logger.debug('🔔 Filtrage par budgetAlerts', {
      userId,
      beforeFilter,
      afterFilter: filteredTokens.length,
      filteredOut: beforeFilter - filteredTokens.length,
    });
  }

  if (requireReminders) {
    const beforeFilter = filteredTokens.length;
    filteredTokens = filteredTokens.filter(token => token.reminders);
    logger.debug('🔔 Filtrage par reminders', {
      userId,
      beforeFilter,
      afterFilter: filteredTokens.length,
      filteredOut: beforeFilter - filteredTokens.length,
    });
  }

  if (requireSubscriptionReminders) {
    const beforeFilter = filteredTokens.length;
    filteredTokens = filteredTokens.filter(token => token.subscriptionReminders);
    logger.debug('🔔 Filtrage par subscriptionReminders', {
      userId,
      beforeFilter,
      afterFilter: filteredTokens.length,
      filteredOut: beforeFilter - filteredTokens.length,
    });
  }

  if (filteredTokens.length === 0) {
    const reason = tokens.length === 0 
      ? 'Aucun token actif' 
      : requireBudgetAlerts 
        ? 'Aucun token avec budgetAlerts activé' 
        : requireReminders 
          ? 'Aucun token avec reminders activé'
          : requireSubscriptionReminders
            ? 'Aucun token avec subscriptionReminders activé'
            : 'Filtrage a exclu tous les tokens';
    
    logger.error('❌ [ERROR] Aucun token disponible pour l\'envoi de notification', {
      status: 'ERROR',
      userId,
      title,
      totalTokens: tokens.length,
      requireBudgetAlerts,
      requireReminders,
      requireSubscriptionReminders,
      reason,
    });
    // Log supplémentaire très visible avec couleurs
    const red = '\x1b[31m';
    const reset = '\x1b[0m';
    console.log('\n' + red + '='.repeat(80) + reset);
    console.log(red + '❌ [STATUS: ERROR] AUCUN TOKEN DISPONIBLE POUR LA NOTIFICATION' + reset);
    console.log(red + '='.repeat(80) + reset);
    console.log(`📱 Titre: ${title}`);
    console.log(`⚠️  Raison: ${reason}`);
    console.log(`📊 Tokens totaux: ${tokens.length}`);
    console.log(`🔔 Requiert budgetAlerts: ${requireBudgetAlerts}`);
    console.log(`🔔 Requiert reminders: ${requireReminders}`);
    console.log(`🔔 Requiert subscriptionReminders: ${requireSubscriptionReminders}`);
    console.log(red + '='.repeat(80) + reset + '\n');
    return { sent: false, reason: 'Aucun token actif ou préférences désactivées' };
  }

  logger.info('✅ Tokens filtrés prêts pour l\'envoi', {
    userId,
    title,
    filteredTokensCount: filteredTokens.length,
  });

  // Extraire les tokens
  const tokenStrings = filteredTokens.map(t => t.token);

  // Logger l'envoi de notification
  logger.info('Envoi de notification push', {
    userId,
    title,
    body,
    tokensCount: tokenStrings.length,
    requireBudgetAlerts,
    requireReminders,
    requireSubscriptionReminders,
  });

  // Envoyer les notifications
  try {
    const tickets = await sendExpoPushNotification(
      tokenStrings,
      title,
      body,
      data
    );

    // Vérifier s'il y a des erreurs dans les tickets
    const errors = tickets.filter(ticket => ticket.status === 'error');
    if (errors.length > 0) {
      logger.warn('⚠️  [WARN] Certaines notifications ont échoué', {
        status: 'PARTIAL_ERROR',
        userId,
        title,
        errorsCount: errors.length,
        errors: errors.map(e => ({
          status: e.status,
          message: e.message,
          details: e.details,
        })),
      });
      // Log supplémentaire très visible avec couleurs
      const yellow = '\x1b[33m';
      const reset = '\x1b[0m';
      console.log('\n' + yellow + '='.repeat(80) + reset);
      console.log(yellow + '⚠️  [STATUS: PARTIAL_ERROR] CERTAINES NOTIFICATIONS ONT ÉCHOUÉ' + reset);
      console.log(yellow + '='.repeat(80) + reset);
      console.log(`📱 Titre: ${title}`);
      console.log(`❌ Erreurs: ${errors.length} / ${tickets.length}`);
      errors.forEach((e, index) => {
        console.log(`  ${index + 1}. ${e.message || 'Erreur inconnue'}`);
      });
      console.log(yellow + '='.repeat(80) + reset + '\n');
    } else {
      logger.info('✅ [SUCCESS] Notifications push envoyées avec succès', {
        status: 'SUCCESS',
        userId,
        title,
        tokensCount: tokenStrings.length,
        ticketsCount: tickets.length,
      });
      // Log supplémentaire très visible avec couleurs
      const green = '\x1b[32m';
      const reset = '\x1b[0m';
      console.log('\n' + green + '='.repeat(80) + reset);
      console.log(green + '✅ [STATUS: SUCCESS] NOTIFICATIONS PUSH ENVOYÉES AVEC SUCCÈS' + reset);
      console.log(green + '='.repeat(80) + reset);
      console.log(`📱 Titre: ${title}`);
      console.log(`💬 Message: ${body}`);
      console.log(`📊 Tokens: ${tokenStrings.length} | Tickets: ${tickets.length}`);
      console.log(green + '='.repeat(80) + reset + '\n');

      // Vérifier les receipts après un court délai (Expo met quelques secondes à traiter)
      // On le fait en arrière-plan pour ne pas bloquer
      const ticketIds = tickets
        .filter(t => t.status === 'ok' && 'id' in t && t.id)
        .map(t => (t as { id: string }).id);

      if (ticketIds.length > 0) {
        // Attendre 5 secondes avant de vérifier les receipts
        setTimeout(async () => {
          try {
            logger.debug('🔍 Vérification des receipts Expo', {
              userId,
              title,
              ticketIdsCount: ticketIds.length,
            });
            await checkPushTicketReceipts(ticketIds);
          } catch (error) {
            logger.error('Erreur lors de la vérification des receipts', {
              userId,
              title,
              error: error instanceof Error ? error.message : 'Erreur inconnue',
            });
          }
        }, 5000); // 5 secondes
      }
    }

    // Sauvegarder la notification dans la base de données
    try {
      const notificationType = data?.type as string || 'UNKNOWN';
      await saveNotificationToDatabase({
        userId,
        type: notificationType,
        title,
        body,
        data: data || {},
      });
    } catch (saveError) {
      // Ne pas faire échouer l'envoi si la sauvegarde échoue
      logger.error('Erreur lors de la sauvegarde de la notification', {
        userId,
        title,
        error: saveError instanceof Error ? saveError.message : 'Erreur inconnue',
      });
    }

    return { sent: true, tickets, count: tickets.length, errors: errors.length };
  } catch (error) {
    logger.error('Erreur lors de l\'envoi des notifications push', {
      userId,
      title,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { sent: false, reason: `Erreur d'envoi: ${error instanceof Error ? error.message : 'Erreur inconnue'}` };
  }
}

/**
 * Envoie une alerte de budget dépassé
 * 
 * @param userId - ID de l'utilisateur
 * @param budgetName - Nom du budget
 * @param spentAmount - Montant dépensé
 * @param limitAmount - Montant limite
 * @param categoryName - Nom de la catégorie (optionnel)
 */
export async function sendBudgetAlert(
  userId: string,
  budgetName: string,
  spentAmount: number,
  limitAmount: number,
  categoryName?: string
) {
  // Déterminer si le budget est exactement à 100% ou dépassé
  const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;
  const isExact = spentAmount === limitAmount;
  const isExceeded = spentAmount > limitAmount;
  
  let title: string;
  let body: string;
  
  if (isExact) {
    title = 'Budget atteint';
    body = `Votre budget "${budgetName}" est atteint à 100% : ${spentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA`;
  } else if (isExceeded) {
    title = 'Budget dépassé';
    body = `Votre budget "${budgetName}" est dépassé : ${spentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA (${percentage.toFixed(0)}%)`;
  } else {
    // Cas de sécurité (ne devrait pas arriver)
    title = 'Budget atteint';
    body = `Votre budget "${budgetName}" atteint ${percentage.toFixed(0)}% : ${spentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA`;
  }
  
  return sendNotificationToUser(
    userId,
    title,
    body,
    {
      type: 'BUDGET_ALERT',
      budgetName,
      spentAmount,
      limitAmount,
      percentage,
      isExceeded,
      categoryName,
    },
    true // requireBudgetAlerts
  );
}

/**
 * Envoie un avertissement de budget (proche de la limite, ex: 80%)
 * 
 * @param userId - ID de l'utilisateur
 * @param budgetName - Nom du budget
 * @param spentAmount - Montant dépensé
 * @param limitAmount - Montant limite
 * @param percentage - Pourcentage atteint
 */
export async function sendBudgetWarning(
  userId: string,
  budgetName: string,
  spentAmount: number,
  limitAmount: number,
  percentage: number
) {
  return sendNotificationToUser(
    userId,
    'Attention budget',
    `Votre budget "${budgetName}" atteint ${percentage.toFixed(0)}% : ${spentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA`,
    {
      type: 'BUDGET_WARNING',
      budgetName,
      spentAmount,
      limitAmount,
      percentage,
    },
    true // requireBudgetAlerts
  );
}

/**
 * Envoie un rappel de transaction
 * 
 * @param userId - ID de l'utilisateur
 */
export async function sendTransactionReminder(userId: string) {
  return sendNotificationToUser(
    userId,
    'Rappel',
    'N\'oubliez pas d\'enregistrer vos dépenses d\'aujourd\'hui',
    {
      type: 'TRANSACTION_REMINDER',
    },
    false,
    true // requireReminders
  );
}

/**
 * Envoie un résumé hebdomadaire
 * 
 * @param userId - ID de l'utilisateur
 * @param totalExpenses - Total des dépenses
 * @param totalIncome - Total des revenus
 * @param topCategories - Top catégories (optionnel)
 */
export async function sendWeeklySummary(
  userId: string,
  totalExpenses: number,
  totalIncome: number,
  topCategories?: Array<{ name: string; amount: number }>
) {
  return sendNotificationToUser(
    userId,
    'Résumé de la semaine',
    `Dépenses: ${totalExpenses.toFixed(2)}€ | Revenus: ${totalIncome.toFixed(2)}€`,
    {
      type: 'WEEKLY_SUMMARY',
      totalExpenses,
      totalIncome,
      topCategories,
    }
  );
}

/**
 * Envoie une notification de rappel de renouvellement d'abonnement externe
 *
 * @deprecated Utilisez sendGroupedSubscriptionReminders pour le nouveau système de notifications groupées quotidiennes
 * @param userId - ID de l'utilisateur
 * @param subscriptionId - ID de l'abonnement
 * @param subscriptionName - Nom de l'abonnement
 * @param amount - Montant en FCFA
 * @param nextBillingDate - Date du prochain renouvellement
 * @param daysUntilRenewal - Nombre de jours avant le renouvellement (doit être 5)
 */
export async function sendSubscriptionRenewalReminder(
  userId: string,
  subscriptionId: string,
  subscriptionName: string,
  amount: number,
  nextBillingDate: Date,
  daysUntilRenewal: number
) {
  const title = 'Renouvellement dans 5 jours';
  const body = `Votre abonnement "${subscriptionName}" sera renouvelé dans 5 jours pour ${amount.toLocaleString()} FCFA`;

  return sendNotificationToUser(
    userId,
    title,
    body,
    {
      type: 'SUBSCRIPTION_RENEWAL_REMINDER',
      subscriptionId,
      subscriptionName,
      amount,
      nextBillingDate: nextBillingDate.toISOString(),
      daysUntilRenewal,
    },
    false, // requireBudgetAlerts
    false, // requireReminders
    true   // requireSubscriptionReminders - NOUVEAU paramètre
  );
}

/**
 * Envoie une notification groupée pour plusieurs abonnements d'un utilisateur
 *
 * Cette fonction envoie UNE notification par jour listant TOUS les abonnements
 * qui expirent bientôt ou qui sont déjà expirés.
 *
 * Formats de messages:
 * - Un seul abonnement:
 *   - J-3 à J-2: "Votre abonnement pour [NOM] prend fin dans [X] jours"
 *   - J-1: "Votre abonnement pour [NOM] prend fin dans 1 jour"
 *   - J: "Votre abonnement [NOM] est terminé. Renouvelez-le"
 *
 * - Plusieurs abonnements:
 *   - Tous actifs: "3 abonnements expirent bientôt: Netflix (3j), Spotify (2j), Disney+ (1j)"
 *   - Tous expirés: "2 abonnements terminés: Netflix, Spotify"
 *   - Mixte: "2 expirent bientôt: Spotify (2j), Disney+ (3j) + 1 terminé: Netflix"
 *
 * @param userId - ID de l'utilisateur
 * @param subscriptions - Liste des abonnements avec leurs jours restants
 */
export async function sendGroupedSubscriptionReminders(
  userId: string,
  subscriptions: Array<{
    id: string;
    name: string;
    nextBillingDate: Date;
    daysUntilRenewal: number;
  }>
) {
  let title: string;
  let body: string;

  // Séparer les abonnements terminés (J) des autres
  const expiredSubs = subscriptions.filter(s => s.daysUntilRenewal === 0);
  const activeSubs = subscriptions.filter(s => s.daysUntilRenewal > 0);

  // CAS 1: Un seul abonnement
  if (subscriptions.length === 1) {
    const sub = subscriptions[0]!; // Safe car length === 1

    if (sub.daysUntilRenewal === 0) {
      title = 'Abonnement terminé';
      body = `Votre abonnement ${sub.name} est terminé. Renouvelez-le`;
    } else if (sub.daysUntilRenewal === 1) {
      title = 'Abonnement bientôt terminé';
      body = `Votre abonnement pour ${sub.name} prend fin dans 1 jour`;
    } else {
      title = 'Abonnement bientôt terminé';
      body = `Votre abonnement pour ${sub.name} prend fin dans ${sub.daysUntilRenewal} jours`;
    }
  }
  // CAS 2: Plusieurs abonnements
  else {
    title = 'Abonnements à renouveler';

    // Liste des abonnements actifs avec jours restants
    const activeList = activeSubs
      .map(s => `${s.name} (${s.daysUntilRenewal}j)`)
      .join(', ');

    // Construire le message
    if (activeSubs.length > 0 && expiredSubs.length === 0) {
      // Seulement des abonnements actifs
      body = `${activeSubs.length} abonnement${activeSubs.length > 1 ? 's' : ''} expire${activeSubs.length > 1 ? 'nt' : ''} bientôt: ${activeList}`;
    } else if (activeSubs.length === 0 && expiredSubs.length > 0) {
      // Seulement des abonnements terminés
      const expiredList = expiredSubs.map(s => s.name).join(', ');
      body = `${expiredSubs.length} abonnement${expiredSubs.length > 1 ? 's' : ''} terminé${expiredSubs.length > 1 ? 's' : ''}: ${expiredList}`;
    } else {
      // Mélange d'actifs et terminés
      const expiredList = expiredSubs.map(s => s.name).join(', ');
      body = `${activeSubs.length} expire${activeSubs.length > 1 ? 'nt' : ''} bientôt: ${activeList} + ${expiredSubs.length} terminé${expiredSubs.length > 1 ? 's' : ''}: ${expiredList}`;
    }
  }

  // Préparer les données pour la notification
  const data = {
    type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    subscriptions: subscriptions.map(s => ({
      subscriptionId: s.id,
      subscriptionName: s.name,
      nextBillingDate: s.nextBillingDate.toISOString(),
      daysUntilRenewal: s.daysUntilRenewal,
    })),
    count: subscriptions.length,
  };

  return sendNotificationToUser(
    userId,
    title,
    body,
    data,
    false, // requireBudgetAlerts
    false, // requireReminders
    true   // requireSubscriptionReminders
  );
}

/**
 * Envoie une notification de rappel de renouvellement d'abonnement premium Budgix
 *
 * @param userId - ID de l'utilisateur
 * @param data - Données de l'abonnement (plan, endDate, daysUntilRenewal)
 */
export async function sendPremiumSubscriptionRenewalReminder(
  userId: string,
  data: {
    plan: 'MONTHLY' | 'ANNUAL';
    endDate: Date;
    daysUntilRenewal: number;
  }
) {
  let title: string;
  let body: string;

  const planLabel = data.plan === 'MONTHLY' ? 'mensuel' : 'annuel';

  // Messages selon les jours restants
  if (data.daysUntilRenewal === 0) {
    title = 'Abonnement premium expiré';
    body = `Votre abonnement premium ${planLabel} est terminé. Renouvelez-le pour continuer à profiter de toutes les fonctionnalités`;
  } else if (data.daysUntilRenewal === 1) {
    title = 'Abonnement premium expire demain';
    body = `Votre abonnement premium ${planLabel} prend fin dans 1 jour`;
  } else {
    title = 'Abonnement premium bientôt terminé';
    body = `Votre abonnement premium ${planLabel} prend fin dans ${data.daysUntilRenewal} jours`;
  }

  // Préparer les données pour la notification
  const notificationData = {
    type: 'PREMIUM_SUBSCRIPTION_EXPIRATION_REMINDER',
    plan: data.plan,
    endDate: data.endDate.toISOString(),
    daysUntilRenewal: data.daysUntilRenewal,
  };

  return sendNotificationToUser(
    userId,
    title,
    body,
    notificationData,
    false, // requireBudgetAlerts
    false, // requireReminders
    true   // requireSubscriptionReminders - Utilise le même flag que les abonnements externes
  );
}

/**
 * Sauvegarde une notification dans la base de données
 *
 * @param options - Options pour sauvegarder la notification
 */
async function saveNotificationToDatabase(options: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
}) {
  const { userId, type, title, body, data } = options;

  // Mapper le type de notification au type Prisma
  let notificationType: 'BUDGET_WARNING' | 'BUDGET_ALERT' | 'TRANSACTION_REMINDER' | 'WEEKLY_SUMMARY' | 'SUBSCRIPTION_RENEWAL_REMINDER' | 'PREMIUM_SUBSCRIPTION_EXPIRATION_REMINDER' | 'PAYMENT_PENDING_VERIFICATION' | 'PAYMENT_APPROVED' | 'PAYMENT_REJECTED';

  switch (type) {
    case 'BUDGET_WARNING':
      notificationType = 'BUDGET_WARNING';
      break;
    case 'BUDGET_ALERT':
      notificationType = 'BUDGET_ALERT';
      break;
    case 'TRANSACTION_REMINDER':
      notificationType = 'TRANSACTION_REMINDER';
      break;
    case 'WEEKLY_SUMMARY':
      notificationType = 'WEEKLY_SUMMARY';
      break;
    case 'SUBSCRIPTION_RENEWAL_REMINDER':
      notificationType = 'SUBSCRIPTION_RENEWAL_REMINDER';
      break;
    case 'PREMIUM_SUBSCRIPTION_EXPIRATION_REMINDER':
      notificationType = 'PREMIUM_SUBSCRIPTION_EXPIRATION_REMINDER';
      break;
    case 'PAYMENT_PENDING_VERIFICATION':
      notificationType = 'PAYMENT_PENDING_VERIFICATION';
      break;
    case 'PAYMENT_APPROVED':
      notificationType = 'PAYMENT_APPROVED';
      break;
    case 'PAYMENT_REJECTED':
      notificationType = 'PAYMENT_REJECTED';
      break;
    default:
      // Pour les types inconnus, on utilise BUDGET_WARNING par défaut
      notificationType = 'BUDGET_WARNING';
      logger.warn('Type de notification inconnu, utilisation de BUDGET_WARNING par défaut', {
        userId,
        type,
        title,
      });
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: notificationType as any,
        title,
        body,
        data: data as any,
        read: false,
      },
    });

    logger.debug('Notification sauvegardée dans la base de données', {
      notificationId: notification.id,
      userId,
      type: notificationType,
      title,
    });

    // Émettre un événement WebSocket pour notifier l'utilisateur en temps réel
    try {
      emitToUser(userId, 'new-notification', {
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          read: notification.read,
          createdAt: notification.createdAt,
        },
      });
      logger.debug('Événement WebSocket émis pour nouvelle notification', {
        userId,
        notificationId: notification.id,
      });
    } catch (wsError) {
      // Ne pas faire échouer la sauvegarde si le WebSocket échoue
      logger.warn('Impossible d\'émettre l\'événement WebSocket pour la notification', {
        userId,
        notificationId: notification.id,
        error: wsError instanceof Error ? wsError.message : 'Erreur inconnue',
      });
    }

    return notification;
  } catch (error) {
    logger.error('Erreur lors de la sauvegarde de la notification', {
      userId,
      type: notificationType,
      title,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Récupère les notifications d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param options - Options de filtrage (read, limit, offset)
 * @returns Liste des notifications
 */
export async function getUserNotifications(
  userId: string,
  options?: {
    read?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const { read, limit = 50, offset = 0 } = options || {};

  const where: any = {
    userId,
  };

  if (read !== undefined) {
    where.read = read;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return notifications;
}

/**
 * Marque une notification comme lue
 * 
 * @param userId - ID de l'utilisateur
 * @param notificationId - ID de la notification
 * @returns La notification mise à jour
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
) {
  // Vérifier que la notification appartient à l'utilisateur
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw createError(
      'Notification non trouvée ou vous n\'avez pas l\'autorisation',
      404,
      'NOTIFICATION_NOT_FOUND'
    );
  }

  // Marquer comme lue
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return updated;
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 * 
 * @param userId - ID de l'utilisateur
 * @returns Nombre de notifications mises à jour
 */
export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  });

  return result.count;
}

/**
 * Récupère le nombre de notifications non lues pour un utilisateur
 *
 * @param userId - ID de l'utilisateur
 * @returns Nombre de notifications non lues
 */
export async function getUnreadNotificationsCount(userId: string) {
  const count = await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });

  return count;
}

/**
 * Supprime une notification spécifique
 *
 * @param userId - ID de l'utilisateur
 * @param notificationId - ID de la notification à supprimer
 * @returns La notification supprimée
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
) {
  // Vérifier que la notification appartient à l'utilisateur
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw createError(
      'Notification non trouvée ou vous n\'avez pas l\'autorisation',
      404,
      'NOTIFICATION_NOT_FOUND'
    );
  }

  // Supprimer la notification
  const deleted = await prisma.notification.delete({
    where: { id: notificationId },
  });

  return deleted;
}

/**
 * Supprime toutes les notifications d'un utilisateur
 *
 * @param userId - ID de l'utilisateur
 * @returns Nombre de notifications supprimées
 */
export async function deleteAllNotifications(userId: string) {
  const result = await prisma.notification.deleteMany({
    where: {
      userId,
    },
  });

  return result.count;
}

