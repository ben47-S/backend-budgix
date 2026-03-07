/**
 * Contrôleur de gestion des statistiques
 * 
 * Gère les requêtes HTTP liées aux statistiques :
 * - Statistiques complètes depuis l'inscription
 * - Totaux depuis l'inscription
 * - Top catégories de dépenses (top 3 si premium, top 2 sinon)
 * - Top catégories de revenus (top 3 si premium uniquement)
 */

import type { Request, Response, NextFunction } from "express";
import {
  getUserStats,
  getTotalsSinceRegistration,
  getTopExpenseCategories,
  getPremiumStats,
} from "../services/stats.service.js";
import { createError } from "../middleware/errorHandler.js";
import { getSpecificPeriodDates, parseDateRange } from "../utils/date.js";

/**
 * Récupère toutes les statistiques de l'utilisateur depuis son inscription
 * 
 * GET /api/stats
 * Retourne : totaux, top catégories de dépenses (top 3 si premium, top 2 sinon),
 *            top catégories de revenus (top 3 si premium uniquement), date d'inscription
 */
export async function getStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Récupérer userId depuis le token JWT (défini par requireAuth)
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const stats = await getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère uniquement les totaux depuis l'inscription
 * 
 * GET /api/stats/totals
 * Retourne : revenus totaux, dépenses totales, différence, nombre de transactions
 */
export async function getTotalsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Récupérer userId depuis le token JWT (défini par requireAuth)
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const totals = await getTotalsSinceRegistration(userId);

    res.json({
      success: true,
      data: totals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère le top des catégories de dépenses les plus utilisées
 * 
 * GET /api/stats/top-categories
 * Retourne : top catégories (top 3 si premium, top 2 sinon) avec nombre de transactions et montant total
 */
export async function getTopCategoriesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Récupérer userId depuis le token JWT (défini par requireAuth)
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const topCategories = await getTopExpenseCategories(userId);

    res.json({
      success: true,
      data: topCategories,
      count: topCategories.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques premium pour une période spécifique
 * 
 * GET /api/stats/premium
 * Query params:
 *   Option 1: startDate (YYYY-MM-DD) + endDate (YYYY-MM-DD) - Période personnalisée
 *   Option 2: date (YYYY-MM-DD) + period (day|week|month|year) - Période relative
 *   Option 3: date (YYYY-MM-DD) seul - Un jour spécifique
 * 
 * Retourne : totaux, top 3 catégories de dépenses + top 3 catégories de revenus pour la période spécifiée
 */
export async function getPremiumStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Récupérer userId depuis le token JWT (défini par requireAuth)
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { startDate, endDate, date, period } = req.query;

    let finalStartDate: Date;
    let finalEndDate: Date;

    // Option 1: Période personnalisée avec startDate et endDate
    if (startDate && endDate) {
      const parsedStart = parseDateRange(startDate as string);
      const parsedEnd = parseDateRange(endDate as string);
      finalStartDate = parsedStart.startDate;
      finalEndDate = parsedEnd.endDate;
    }
    // Option 2: Date de référence + période relative
    else if (date && period) {
      const periodDates = getSpecificPeriodDates(
        period as "day" | "week" | "month" | "year",
        date as string
      );
      finalStartDate = periodDates.startDate;
      finalEndDate = periodDates.endDate;
    }
    // Option 3: Date seule (un jour spécifique)
    else if (date) {
      const dayRange = parseDateRange(date as string);
      finalStartDate = dayRange.startDate;
      finalEndDate = dayRange.endDate;
    } else {
      throw createError(
        "Vous devez fournir soit (startDate + endDate), soit (date + period), soit (date seul)",
        400,
        "INVALID_DATE_PARAMS"
      );
    }

    // Vérifier que startDate <= endDate
    if (finalStartDate > finalEndDate) {
      throw createError(
        "La date de début doit être antérieure ou égale à la date de fin",
        400,
        "INVALID_DATE_RANGE"
      );
    }

    const stats = await getPremiumStats(userId, finalStartDate, finalEndDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

