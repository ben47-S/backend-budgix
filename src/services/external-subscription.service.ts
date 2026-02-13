/**
 * Service de gestion des abonnements externes (fonctionnalité premium)
 * 
 * Ce service gère :
 * - La création d'abonnements externes (Netflix, Spotify, etc.)
 * - Le calcul automatique de nextBillingDate selon le cycle
 * - La mise à jour et suppression d'abonnements
 * - Le renouvellement d'abonnements
 * - La désactivation automatique des abonnements expirés
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { getUserById } from "./auth.service";
import type { BillingCycle } from "../../generated/prisma/client";

/**
 * Calcule la date du prochain renouvellement selon le cycle de facturation
 * 
 * @param startDate - Date de début
 * @param billingCycle - Cycle de facturation
 * @param customDays - Nombre de jours pour cycle personnalisé (si billingCycle = CUSTOM)
 * @returns Date du prochain renouvellement
 */
export function calculateNextBillingDate(
  startDate: Date,
  billingCycle: BillingCycle,
  customDays?: number | null
): Date {
  const nextDate = new Date(startDate);

  switch (billingCycle) {
    case "MONTHLY":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "QUARTERLY":
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case "ANNUAL":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case "CUSTOM":
      if (!customDays || customDays <= 0) {
        throw createError(
          "customDays est requis pour un cycle personnalisé",
          400,
          "CUSTOM_DAYS_REQUIRED"
        );
      }
      nextDate.setDate(nextDate.getDate() + customDays);
      break;
    default:
      throw createError("Cycle de facturation invalide", 400, "INVALID_BILLING_CYCLE");
  }

  return nextDate;
}

/**
 * Crée un nouvel abonnement externe
 * 
 * @param userId - ID de l'utilisateur
 * @param data - Données de l'abonnement
 * @returns L'abonnement créé
 */
export async function createExternalSubscription(
  userId: string,
  data: {
    name: string;
    amount: number;
    startDate: Date;
    billingCycle: BillingCycle;
    customDays?: number | null;
    categoryId?: string | null;
    notes?: string | null;
  }
) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  const { name, amount, startDate, billingCycle, customDays, categoryId, notes } = data;

  // Valider que customDays est fourni si billingCycle = CUSTOM
  if (billingCycle === "CUSTOM" && (!customDays || customDays <= 0)) {
    throw createError(
      "customDays est requis pour un cycle personnalisé",
      400,
      "CUSTOM_DAYS_REQUIRED"
    );
  }

  // Valider que la catégorie existe si fournie
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
    }
  }

  // Calculer la date du prochain renouvellement
  const nextBillingDate = calculateNextBillingDate(startDate, billingCycle, customDays);

  // Construire l'objet data conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
  const subscriptionData: {
    userId: string;
    name: string;
    amount: number;
    startDate: Date;
    billingCycle: BillingCycle;
    customDays: number | null;
    nextBillingDate: Date;
    categoryId: string | null;
    notes: string | null;
    isActive: boolean;
  } = {
    userId,
    name,
    amount,
    startDate,
    billingCycle,
    customDays: billingCycle === "CUSTOM" ? (customDays ?? null) : null,
    nextBillingDate,
    categoryId: categoryId || null,
    notes: notes || null,
    isActive: true,
  };

  // Créer l'abonnement
  const subscription = await prisma.externalSubscription.create({
    data: subscriptionData,
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Met à jour un abonnement externe
 * 
 * @param userId - ID de l'utilisateur
 * @param subscriptionId - ID de l'abonnement
 * @param data - Données à mettre à jour
 * @returns L'abonnement mis à jour
 */
export async function updateExternalSubscription(
  userId: string,
  subscriptionId: string,
  data: {
    name?: string;
    amount?: number;
    startDate?: Date;
    billingCycle?: BillingCycle;
    customDays?: number | null;
    categoryId?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Vérifier que l'abonnement existe et appartient à l'utilisateur
  const existing = await prisma.externalSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
  });

  if (!existing) {
    throw createError(
      "Abonnement non trouvé ou vous n'avez pas l'autorisation",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  // Valider customDays si billingCycle change vers CUSTOM
  const newBillingCycle = data.billingCycle || existing.billingCycle;
  const newCustomDays = data.customDays !== undefined ? data.customDays : existing.customDays;
  
  if (newBillingCycle === "CUSTOM" && (!newCustomDays || newCustomDays <= 0)) {
    throw createError(
      "customDays est requis pour un cycle personnalisé",
      400,
      "CUSTOM_DAYS_REQUIRED"
    );
  }

  // Valider la catégorie si fournie
  if (data.categoryId !== undefined && data.categoryId !== null) {
    const category = await prisma.category.findFirst({
      where: {
        id: data.categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
    }
  }

  // Recalculer nextBillingDate si startDate ou billingCycle change
  const newStartDate = data.startDate || existing.startDate;
  const shouldRecalculate = 
    data.startDate !== undefined || 
    data.billingCycle !== undefined ||
    (data.billingCycle === "CUSTOM" && data.customDays !== undefined);

  let nextBillingDate = existing.nextBillingDate;
  if (shouldRecalculate) {
    nextBillingDate = calculateNextBillingDate(
      newStartDate,
      newBillingCycle,
      newCustomDays
    );
  }

  // Mettre à jour l'abonnement
  const updated = await prisma.externalSubscription.update({
    where: { id: subscriptionId },
    data: {
      ...data,
      nextBillingDate,
      customDays: newBillingCycle === "CUSTOM" ? newCustomDays : null,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updated;
}

/**
 * Récupère un abonnement externe par son ID
 * 
 * @param userId - ID de l'utilisateur
 * @param subscriptionId - ID de l'abonnement
 * @returns L'abonnement trouvé
 */
export async function getExternalSubscriptionById(
  userId: string,
  subscriptionId: string
) {
  const subscription = await prisma.externalSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!subscription) {
    throw createError(
      "Abonnement non trouvé ou vous n'avez pas l'autorisation",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  // Ajouter le statut d'expiration
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextBillingDateOnly = new Date(
    subscription.nextBillingDate.getFullYear(),
    subscription.nextBillingDate.getMonth(),
    subscription.nextBillingDate.getDate()
  );
  
  const isExpired = nextBillingDateOnly <= today;
  const expirationStatus = isExpired ? "échéance atteinte" : null;

  return {
    ...subscription,
    expirationStatus,
  };
}

/**
 * Récupère tous les abonnements externes d'un utilisateur avec filtres
 * Note: La désactivation automatique des abonnements expirés est gérée par le cron quotidien
 *
 * @param userId - ID de l'utilisateur
 * @param options - Options de filtrage
 * @returns Liste des abonnements et métriques
 */
export async function getExternalSubscriptions(
  userId: string,
  options?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  // S'assurer que limit et offset sont des nombres
  const limit = options?.limit !== undefined
    ? (typeof options.limit === 'number' ? options.limit : parseInt(String(options.limit), 10))
    : 100;
  const offset = options?.offset !== undefined
    ? (typeof options.offset === 'number' ? options.offset : parseInt(String(options.offset), 10))
    : 0;
  const isActive = options?.isActive;

  // Date du jour pour calculer le statut d'expiration
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Date sans heure pour comparaison

  const where: any = {
    userId,
  };

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  // Récupérer les abonnements
  const subscriptions = await prisma.externalSubscription.findMany({
    where,
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      nextBillingDate: "asc", // Plus proche en premier
    },
    take: limit,
    skip: offset,
  });

  // Ajouter le statut d'expiration pour chaque abonnement
  const subscriptionsWithStatus = subscriptions.map((sub) => {
    const nextBillingDateOnly = new Date(
      sub.nextBillingDate.getFullYear(),
      sub.nextBillingDate.getMonth(),
      sub.nextBillingDate.getDate()
    );
    
    // Vérifier si l'abonnement est à échéance
    const isExpired = nextBillingDateOnly <= today;
    const expirationStatus = isExpired ? "échéance atteinte" : null;
    
    return {
      ...sub,
      expirationStatus, // Ajouter le statut d'expiration
    };
  });

  // Calculer le total de tous les abonnements actifs (exclure ceux à échéance)
  // Note: Somme brute sans conversion de période
  const activeSubscriptions = await prisma.externalSubscription.findMany({
    where: {
      userId,
      isActive: true,
      // Exclure les abonnements à échéance (nextBillingDate <= aujourd'hui)
      nextBillingDate: {
        gt: today,
      },
    },
  });

  // Somme simple de tous les montants (sans conversion)
  let totalMonthly = 0;
  for (const sub of activeSubscriptions) {
    totalMonthly += sub.amount;
  }

  // Compter le total
  const total = await prisma.externalSubscription.count({
    where: {
      userId,
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return {
    subscriptions: subscriptionsWithStatus,
    total,
    totalMonthly: Math.round(totalMonthly), // Somme brute de tous les montants (exclut les abonnements à échéance)
  };
}

/**
 * Supprime un abonnement externe
 * 
 * @param userId - ID de l'utilisateur
 * @param subscriptionId - ID de l'abonnement
 */
export async function deleteExternalSubscription(
  userId: string,
  subscriptionId: string
) {
  // Vérifier que l'abonnement existe et appartient à l'utilisateur
  const subscription = await prisma.externalSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
  });

  if (!subscription) {
    throw createError(
      "Abonnement non trouvé ou vous n'avez pas l'autorisation",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  // Supprimer l'abonnement
  await prisma.externalSubscription.delete({
    where: { id: subscriptionId },
  });
}

/**
 * Marque un abonnement comme renouvelé
 * Met à jour startDate et recalcule nextBillingDate
 * Réactive l'abonnement si il était désactivé
 * 
 * @param userId - ID de l'utilisateur
 * @param subscriptionId - ID de l'abonnement
 * @param renewalDate - Date de renouvellement (optionnel, défaut: maintenant)
 * @returns L'abonnement mis à jour
 */
export async function renewExternalSubscription(
  userId: string,
  subscriptionId: string,
  renewalDate?: Date
) {
  // Vérifier que l'abonnement existe et appartient à l'utilisateur
  const existing = await prisma.externalSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
  });

  if (!existing) {
    throw createError(
      "Abonnement non trouvé ou vous n'avez pas l'autorisation",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  // Utiliser la date fournie ou la date actuelle comme nouvelle date de début
  const newStartDate = renewalDate || new Date();
  
  // Recalculer la date du prochain renouvellement
  const nextBillingDate = calculateNextBillingDate(
    newStartDate,
    existing.billingCycle,
    existing.customDays
  );

  // Mettre à jour l'abonnement et réactiver si nécessaire
  const updated = await prisma.externalSubscription.update({
    where: { id: subscriptionId },
    data: {
      startDate: newStartDate,
      nextBillingDate,
      isActive: true, // Réactiver l'abonnement lors du renouvellement
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updated;
}

