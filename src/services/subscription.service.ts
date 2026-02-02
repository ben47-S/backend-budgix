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
import type { SubscriptionPlan } from "../../generated/prisma/client";

// Prix de base des abonnements (en USD)
export const MONTHLY_PRICE = 1.09; // Prix mensuel en USD
export const ANNUAL_PRICE = 10.99; // Prix annuel en USD (réduction par rapport à 12 mois)

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

