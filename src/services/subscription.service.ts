/**
 * Service de gestion des abonnements premium
 * 
 * Ce service gère :
 * - La création d'abonnements (mensuel ou annuel)
 * - Le calcul des prix (avec réduction pour abonnement annuel)
 * - La mise à jour du statut premium de l'utilisateur
 * - La vérification du statut d'abonnement
 * - La récupération des informations d'abonnement
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { getUserById } from "./auth.service";
import type { SubscriptionPlan } from "../generated/prisma/client";

// Prix de base des abonnements (en XOF - FCFA)
export const MONTHLY_PRICE = 450; // Prix mensuel en XOF
export const ANNUAL_PRICE = 4200; // Prix annuel en XOF (réduction par rapport à 12 mois)

/**
 * Calcule le prix d'un abonnement selon le plan
 * 
 * @param plan - Plan d'abonnement (MONTHLY ou ANNUAL)
 * @returns Le prix de l'abonnement
 */
export function calculateSubscriptionPrice(plan: SubscriptionPlan): number {
  switch (plan) {
    case "MONTHLY":
      return MONTHLY_PRICE;
    case "ANNUAL":
      return ANNUAL_PRICE;
    default:
      throw createError("Plan d'abonnement invalide", 400, "INVALID_PLAN");
  }
}

/**
 * Calcule la date de fin d'un abonnement selon le plan
 * 
 * @param plan - Plan d'abonnement (MONTHLY ou ANNUAL)
 * @param startDate - Date de début de l'abonnement
 * @returns La date de fin de l'abonnement
 */
export function calculateEndDate(
  plan: SubscriptionPlan,
  startDate: Date = new Date()
): Date {
  const endDate = new Date(startDate);
  
  switch (plan) {
    case "MONTHLY":
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case "ANNUAL":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    default:
      throw createError("Plan d'abonnement invalide", 400, "INVALID_PLAN");
  }
  
  return endDate;
}

/**
 * Vérifie si un abonnement est actif
 * 
 * @param subscription - Abonnement à vérifier
 * @returns true si l'abonnement est actif, false sinon
 */
export function isSubscriptionActive(subscription: {
  endDate: Date | null;
}): boolean {
  if (!subscription.endDate) {
    return true; // Abonnement actif si endDate est null
  }
  return subscription.endDate > new Date();
}

/**
 * Crée ou met à jour un abonnement pour un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param plan - Plan d'abonnement (MONTHLY ou ANNUAL)
 * @returns L'abonnement créé ou mis à jour
 */
export async function createOrUpdateSubscription(
  userId: string,
  plan: SubscriptionPlan
) {
  // Vérifier que l'utilisateur existe
  await getUserById(userId);

  // Calculer le prix et la date de fin
  const price = calculateSubscriptionPrice(plan);
  const startDate = new Date();
  const endDate = calculateEndDate(plan, startDate);

  // Vérifier si l'utilisateur a déjà un abonnement
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  let subscription;

  if (existingSubscription) {
    // Mettre à jour l'abonnement existant
    subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        price,
        startDate,
        endDate,
      },
    });
  } else {
    // Créer un nouvel abonnement
    subscription = await prisma.subscription.create({
      data: {
        userId,
        plan,
        price,
        startDate,
        endDate,
      },
    });
  }

  // Mettre à jour le statut premium de l'utilisateur
  await prisma.user.update({
    where: { id: userId },
    data: { isPremium: true },
  });

  return subscription;
}

/**
 * Renouvelle ou crée un abonnement pour un utilisateur
 *
 * Cette fonction gère deux scénarios :
 * 1. RENOUVELLEMENT : Si isRenewal=true et un abonnement existe, étend la date de fin
 *    en ajoutant la durée du plan à la date de fin actuelle (préserve startDate)
 * 2. NOUVEAU : Sinon, réinitialise complètement avec une nouvelle startDate et endDate
 *
 * @param userId - ID de l'utilisateur
 * @param plan - Plan d'abonnement (MONTHLY ou ANNUAL)
 * @param isRenewal - true si c'est un renouvellement, false si c'est un nouvel abonnement
 * @returns L'abonnement créé ou mis à jour
 */
export async function renewOrCreateSubscription(
  userId: string,
  plan: SubscriptionPlan,
  isRenewal: boolean = false
) {
  // Vérifier que l'utilisateur existe
  await getUserById(userId);

  // Calculer le prix
  const price = calculateSubscriptionPrice(plan);

  // Vérifier si l'utilisateur a déjà un abonnement
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  let subscription;

  if (existingSubscription && isRenewal) {
    // CAS RENOUVELLEMENT : Étendre la date de fin
    const currentEndDate = existingSubscription.endDate || new Date();

    // Si l'abonnement est déjà expiré, partir d'aujourd'hui
    const baseDate = currentEndDate > new Date() ? currentEndDate : new Date();

    const newEndDate = new Date(baseDate);
    if (plan === 'MONTHLY') {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else if (plan === 'ANNUAL') {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        price,
        // startDate RESTE INCHANGÉ - on préserve la date de début originale
        endDate: newEndDate,
      },
    });
  } else {
    // CAS NOUVEAU : Créer ou réinitialiser complètement
    const startDate = new Date();
    const endDate = calculateEndDate(plan, startDate);

    if (existingSubscription) {
      subscription = await prisma.subscription.update({
        where: { userId },
        data: {
          plan,
          price,
          startDate,
          endDate,
        },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          plan,
          price,
          startDate,
          endDate,
        },
      });
    }
  }

  // Mettre à jour le statut premium de l'utilisateur
  await prisma.user.update({
    where: { id: userId },
    data: { isPremium: true },
  });

  return subscription;
}

/**
 * Récupère l'abonnement d'un utilisateur
 *
 * @param userId - ID de l'utilisateur
 * @returns L'abonnement de l'utilisateur ou null
 */
export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  return subscription;
}

/**
 * Vérifie et met à jour le statut premium d'un utilisateur selon son abonnement
 * 
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur est premium, false sinon
 */
export async function checkAndUpdatePremiumStatus(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    // Pas d'abonnement, retirer le statut premium
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    });
    return false;
  }

  const isActive = isSubscriptionActive(subscription);

  if (!isActive && subscription.endDate) {
    // Abonnement expiré, mettre endDate à null et retirer le statut premium
    await prisma.subscription.update({
      where: { userId },
      data: { endDate: null },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    });
    return false;
  }

  // Abonnement actif, s'assurer que le statut premium est activé
  await prisma.user.update({
    where: { id: userId },
    data: { isPremium: true },
  });

  return true;
}

/**
 * Annule un abonnement (met finDate à la date actuelle)
 * 
 * @param userId - ID de l'utilisateur
 * @returns L'abonnement annulé
 */
export async function cancelSubscription(userId: string) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw createError(
      "Aucun abonnement trouvé pour cet utilisateur",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  // Mettre la date de fin à maintenant
  const cancelledSubscription = await prisma.subscription.update({
    where: { userId },
    data: {
      endDate: new Date(),
    },
  });

  // Retirer le statut premium
  await prisma.user.update({
    where: { id: userId },
    data: { isPremium: false },
  });

  return cancelledSubscription;
}

/**
 * Calcule la progression de l'abonnement premium d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Les informations de progression de l'abonnement
 */
export async function getSubscriptionProgress(userId: string) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw createError(
      "Aucun abonnement trouvé pour cet utilisateur",
      404,
      "SUBSCRIPTION_NOT_FOUND"
    );
  }

  const now = new Date();
  const startDate = new Date(subscription.startDate);
  const endDate = subscription.endDate ? new Date(subscription.endDate) : null;

  if (!endDate) {
    // Abonnement sans date de fin (actif indéfiniment)
    return {
      subscription,
      isActive: true,
      progressPercentage: null,
      daysElapsed: Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      daysRemaining: null,
      totalDays: null,
      startDate,
      endDate: null,
      plan: subscription.plan,
    };
  }

  // Calculer la durée totale de l'abonnement en jours
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculer les jours écoulés
  const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculer les jours restants
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculer le pourcentage de progression (0-100)
  let progressPercentage: number;
  if (now >= endDate) {
    progressPercentage = 100; // Abonnement expiré
  } else if (now <= startDate) {
    progressPercentage = 0; // Pas encore commencé
  } else {
    progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
  }

  const isActive = isSubscriptionActive(subscription);

  return {
    subscription,
    isActive,
    progressPercentage: Math.round(progressPercentage * 100) / 100, // Arrondir à 2 décimales
    daysElapsed: Math.max(0, daysElapsed),
    daysRemaining: Math.max(0, daysRemaining),
    totalDays,
    startDate,
    endDate,
    plan: subscription.plan,
  };
}

