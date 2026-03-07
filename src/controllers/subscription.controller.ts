/**
 * Contrôleurs pour la gestion des abonnements premium
 * 
 * Gère :
 * - La création/mise à jour d'abonnements
 * - La récupération des informations d'abonnement
 * - L'annulation d'abonnements
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler.js";
import {
  createOrUpdateSubscription,
  getUserSubscription,
  checkAndUpdatePremiumStatus,
  cancelSubscription,
  isSubscriptionActive,
  getSubscriptionProgress,
  MONTHLY_PRICE,
  ANNUAL_PRICE,
} from "../services/subscription.service.js";
import {
  formatSubscriptionPrice,
  formatSubscriptionPlan,
  calculateSavings,
} from "../utils/price-formatter.js";
import { formatDatesToISO } from "../utils/date-formatter.js";
import type { CreateSubscriptionRequest } from "../types/index.js";

/**
 * Crée ou met à jour un abonnement pour l'utilisateur connecté
 * 
 * POST /api/subscriptions
 * Headers: Authorization: Bearer <token>
 * Body: { plan: "MONTHLY" | "ANNUAL" }
 */
export async function createSubscriptionController(
  req: Request<{}, {}, CreateSubscriptionRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { plan } = req.body;

    // Valider le plan
    if (!plan || (plan !== "MONTHLY" && plan !== "ANNUAL")) {
      throw createError(
        "Plan d'abonnement invalide. Doit être MONTHLY ou ANNUAL",
        400,
        "INVALID_PLAN"
      );
    }

    // Créer ou mettre à jour l'abonnement
    const subscription = await createOrUpdateSubscription(userId, plan);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement créé avec succès",
      data: {
        subscription,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère l'abonnement de l'utilisateur connecté
 * 
 * GET /api/subscriptions
 * Headers: Authorization: Bearer <token>
 */
export async function getSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const subscription = await getUserSubscription(userId);

    if (!subscription) {
return res.json(formatDatesToISO({
        success: true,
        message: "Aucun abonnement trouvé",
        data: {
          subscription: null,
          isActive: false,
          isPremium: false,
          daysRemaining: null,
          nextRenewalDate: null,
          formattedPrice: null,
          formattedPlan: null,
          status: "NO_SUBSCRIPTION",
          monthlyPrice: MONTHLY_PRICE,
          annualPrice: ANNUAL_PRICE,
          savings: calculateSavings(MONTHLY_PRICE, ANNUAL_PRICE),
        },
      }));
    }

    const isActive = isSubscriptionActive(subscription);
    const isPremium = await checkAndUpdatePremiumStatus(userId);
    
    // Calculer les jours restants
    let daysRemaining: number | null = null;
    let nextRenewalDate: Date | null = null;
    let status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "NO_SUBSCRIPTION" = "NO_SUBSCRIPTION";

    if (subscription.endDate) {
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      nextRenewalDate = endDate;
      
      if (isActive) {
        status = "ACTIVE";
      } else {
        status = "EXPIRED";
      }
    } else if (subscription.endDate === null && isActive) {
      status = "ACTIVE";
    } else {
      status = "CANCELLED";
    }

    // Formater le prix et le plan
    const priceNumber = typeof subscription.price === "string" 
      ? parseFloat(subscription.price) 
      : Number(subscription.price);
    const formattedPrice = formatSubscriptionPrice(priceNumber);
    const formattedPlan = formatSubscriptionPlan(subscription.plan);

res.json(formatDatesToISO({
      success: true,
      data: {
        subscription,
        isActive,
        isPremium,
        daysRemaining,
        nextRenewalDate,
        formattedPrice,
        formattedPlan,
        status,
        monthlyPrice: MONTHLY_PRICE,
        annualPrice: ANNUAL_PRICE,
        savings: calculateSavings(MONTHLY_PRICE, ANNUAL_PRICE),
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie et met à jour le statut premium de l'utilisateur
 * 
 * POST /api/subscriptions/check-status
 * Headers: Authorization: Bearer <token>
 */
export async function checkSubscriptionStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const isPremium = await checkAndUpdatePremiumStatus(userId);
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
return res.json(formatDatesToISO({
        success: true,
        data: {
          isPremium,
          subscription: null,
          isActive: false,
        },
      }));
    }

    const isActive = isSubscriptionActive(subscription);

res.json(formatDatesToISO({
      success: true,
      data: {
        isPremium,
        subscription: subscription || null,
        isActive,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Annule l'abonnement de l'utilisateur connecté
 * 
 * POST /api/subscriptions/cancel
 * Headers: Authorization: Bearer <token>
 */
export async function cancelSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const subscription = await cancelSubscription(userId);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement annulé avec succès",
      data: {
        subscription,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère la progression de l'abonnement premium de l'utilisateur connecté
 * 
 * GET /api/subscriptions/progress
 * Headers: Authorization: Bearer <token>
 */
export async function getSubscriptionProgressController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const progress = await getSubscriptionProgress(userId);

res.json(formatDatesToISO({
      success: true,
      message: "Progression de l'abonnement récupérée avec succès",
      data: progress,
    }));
  } catch (error) {
    next(error);
  }
}

