/**
 * Contrôleurs pour la gestion des abonnements externes (fonctionnalité premium)
 * 
 * Gère :
 * - La création d'abonnements externes
 * - La récupération de la liste et des détails
 * - La mise à jour d'abonnements
 * - La suppression d'abonnements
 * - Le renouvellement d'abonnements
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler";
import {
  createExternalSubscription,
  getExternalSubscriptions,
  getExternalSubscriptionById,
  updateExternalSubscription,
  deleteExternalSubscription,
  renewExternalSubscription,
} from "../services/external-subscription.service";
import { formatDatesToISO } from "../utils/date-formatter";

/**
 * Récupère tous les abonnements externes de l'utilisateur
 * 
 * GET /api/external-subscriptions
 * Query: { isActive?: boolean, limit?: number, offset?: number }
 */
export async function getExternalSubscriptionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    // Conversion explicite des query params en nombres
    const isActive = req.query.isActive !== undefined 
      ? (typeof req.query.isActive === 'boolean' 
          ? req.query.isActive 
          : req.query.isActive === 'true')
      : undefined;
    
    const limit = req.query.limit !== undefined
      ? (typeof req.query.limit === 'number' 
          ? req.query.limit 
          : parseInt(String(req.query.limit), 10))
      : undefined;
    
    const offset = req.query.offset !== undefined
      ? (typeof req.query.offset === 'number' 
          ? req.query.offset 
          : parseInt(String(req.query.offset), 10))
      : undefined;

    // Construire l'objet options conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
    const options: {
      isActive?: boolean;
      limit?: number;
      offset?: number;
    } = {};
    
    if (isActive !== undefined) {
      options.isActive = isActive;
    }
    if (limit !== undefined) {
      options.limit = limit;
    }
    if (offset !== undefined) {
      options.offset = offset;
    }

    const result = await getExternalSubscriptions(userId, options);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnements récupérés avec succès",
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère un abonnement externe par son ID
 * 
 * GET /api/external-subscriptions/:id
 */
export async function getExternalSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;
    
    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError("ID de l'abonnement requis", 400, "MISSING_SUBSCRIPTION_ID");
    }

    const subscription = await getExternalSubscriptionById(userId, id);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement récupéré avec succès",
      data: {
        subscription,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Crée un nouvel abonnement externe
 * 
 * POST /api/external-subscriptions
 * Body: { name, amount, startDate, billingCycle, customDays?, categoryId?, notes? }
 */
export async function createExternalSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { name, amount, startDate, billingCycle, customDays, categoryId, notes } = req.body;

    // Validation basique
    if (!name || !amount || !startDate || !billingCycle) {
      throw createError(
        "name, amount, startDate et billingCycle sont requis",
        400,
        "MISSING_REQUIRED_FIELDS"
      );
    }

    // Valider que amount est un nombre positif
    if (typeof amount !== "number" || amount <= 0) {
      throw createError("amount doit être un nombre positif", 400, "INVALID_AMOUNT");
    }

    // Valider billingCycle
    const validCycles = ["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"];
    if (!validCycles.includes(billingCycle)) {
      throw createError(
        "billingCycle doit être MONTHLY, QUARTERLY, ANNUAL ou CUSTOM",
        400,
        "INVALID_BILLING_CYCLE"
      );
    }

    // Convertir startDate en Date
    const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);

    const subscription = await createExternalSubscription(userId, {
      name,
      amount: Math.round(amount), // S'assurer que c'est un entier
      startDate: startDateObj,
      billingCycle,
      customDays: customDays || null,
      categoryId: categoryId || null,
      notes: notes || null,
    });

res.status(201).json(formatDatesToISO({
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
 * Met à jour un abonnement externe
 * 
 * PUT /api/external-subscriptions/:id
 * Body: { name?, amount?, startDate?, billingCycle?, customDays?, categoryId?, notes?, isActive? }
 */
export async function updateExternalSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;
    
    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError("ID de l'abonnement requis", 400, "MISSING_SUBSCRIPTION_ID");
    }

    const { name, amount, startDate, billingCycle, customDays, categoryId, notes, isActive } = req.body;

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        throw createError("amount doit être un nombre positif", 400, "INVALID_AMOUNT");
      }
      updateData.amount = Math.round(amount);
    }
    if (startDate !== undefined) {
      updateData.startDate = startDate instanceof Date ? startDate : new Date(startDate);
    }
    if (billingCycle !== undefined) {
      const validCycles = ["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"];
      if (!validCycles.includes(billingCycle)) {
        throw createError(
          "billingCycle doit être MONTHLY, QUARTERLY, ANNUAL ou CUSTOM",
          400,
          "INVALID_BILLING_CYCLE"
        );
      }
      updateData.billingCycle = billingCycle;
    }
    if (customDays !== undefined) updateData.customDays = customDays || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const subscription = await updateExternalSubscription(userId, id, updateData);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement mis à jour avec succès",
      data: {
        subscription,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un abonnement externe
 * 
 * DELETE /api/external-subscriptions/:id
 */
export async function deleteExternalSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;
    
    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError("ID de l'abonnement requis", 400, "MISSING_SUBSCRIPTION_ID");
    }

    await deleteExternalSubscription(userId, id);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement supprimé avec succès",
      data: {
        id,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Marque un abonnement comme renouvelé
 * 
 * POST /api/external-subscriptions/:id/renew
 */
export async function renewExternalSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;
    
    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError("ID de l'abonnement requis", 400, "MISSING_SUBSCRIPTION_ID");
    }

    const { renewalDate } = req.body || {};
    
    // Utiliser la date fournie ou la date actuelle par défaut
    const renewalDateObj = renewalDate ? new Date(renewalDate) : new Date();
    
    const subscription = await renewExternalSubscription(userId, id, renewalDateObj);

res.json(formatDatesToISO({
      success: true,
      message: "Abonnement renouvelé avec succès",
      data: {
        subscription,
      },
    }));
  } catch (error) {
    next(error);
  }
}

