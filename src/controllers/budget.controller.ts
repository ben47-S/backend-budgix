/**
 * Contrôleur de gestion des budgets (fonctionnalité premium)
 *
 * Gère les requêtes HTTP liées aux budgets :
 * - Création / mise à jour d'un budget pour une période donnée
 * - Récupération de la progression des budgets (pour alimenter les rapports)
 * - Suppression d'un budget
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler.js";
import {
  upsertBudgetForPeriod,
  getBudgetsOverviewForPeriod,
  deleteBudgetById,
  checkAllBudgetsForUser,
  upsertMonthlyBudget,
  getMonthlyBudgets,
  getAllBudgets,
} from "../services/budget.service.js";
import { formatDatesToISO } from "../utils/date-formatter.js";
import { parseDate } from "../utils/date.js";

/**
 * Crée ou met à jour un budget pour l'utilisateur connecté (premium)
 *
 * POST /api/budgets
 * Body: { amount: number, startDate: string, endDate: string, categoryId?: string | null }
 */
export async function upsertBudgetController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { amount, startDate, endDate, categoryId, type } = req.body;

    // Parser les dates au format jj-mm-yyyy
    const periodStart = parseDate(startDate);
    const periodEnd = parseDate(endDate);

    const budget = await upsertBudgetForPeriod({
      userId,
      amount,
      periodStart,
      periodEnd,
      categoryId: categoryId ?? null,
      type: type ?? "CUSTOM",
    });

res.status(201).json(formatDatesToISO({
      success: true,
      message: "Budget enregistré avec succès",
      data: budget,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Crée ou met à jour un budget mensuel pour l'utilisateur connecté (premium)
 *
 * POST /api/budgets/monthly
 * Body: { amount: number, year: number, month: number, categoryId?: string | null }
 */
export async function upsertMonthlyBudgetController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { amount, year, month, categoryId } = req.body;

    if (year === undefined || month === undefined) {
      throw createError("year et month sont requis", 400, "MISSING_YEAR_MONTH");
    }

    if (month < 0 || month > 11) {
      throw createError("month doit être entre 0 et 11 (0 = janvier)", 400, "INVALID_MONTH");
    }

    const budget = await upsertMonthlyBudget({
      userId,
      amount,
      year: Number(year),
      month: Number(month),
      categoryId: categoryId ?? null,
    });

res.status(201).json(formatDatesToISO({
      success: true,
      message: "Budget mensuel enregistré avec succès",
      data: budget,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les budgets mensuels de l'utilisateur connecté (premium)
 *
 * GET /api/budgets/monthly?year=2026&month=0&includePast=true
 */
export async function getMonthlyBudgetsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { year, month, includePast, categoryId } = req.query;

    const options: {
      year?: number;
      month?: number;
      includePast?: boolean;
      categoryId?: string | null;
    } = {};

    if (year !== undefined) {
      options.year = Number(year);
    }

    if (month !== undefined) {
      const monthNum = Number(month);
      if (monthNum < 0 || monthNum > 11) {
        throw createError("month doit être entre 0 et 11 (0 = janvier)", 400, "INVALID_MONTH");
      }
      options.month = monthNum;
    }

    if (includePast !== undefined) {
      // After Zod validation, includePast is transformed to boolean
      // But TypeScript doesn't know this, so we handle both cases
      if (typeof includePast === "boolean") {
        options.includePast = includePast;
      } else if (typeof includePast === "string") {
        options.includePast = includePast === "true" || includePast === "1";
      }
    }

    if (categoryId !== undefined) {
      options.categoryId = categoryId === "null" || categoryId === null ? null : String(categoryId);
    }

const budgets = await getMonthlyBudgets(userId, options);

    res.json(formatDatesToISO({
      success: true,
      data: {
        budgets,
      },
      count: budgets.length,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère la progression des budgets pour une période donnée
 *
 * GET /api/budgets/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export async function getBudgetsOverviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw createError(
        "startDate et endDate sont requis (jj-mm-yyyy)",
        400,
        "MISSING_DATE_PARAMS"
      );
    }

    // Parser les dates au format jj-mm-yyyy
    const periodStart = parseDate(startDate as string);
    const periodEnd = parseDate(endDate as string);

    const overview = await getBudgetsOverviewForPeriod({
      userId,
      periodStart,
      periodEnd,
    });

    res.json({
      success: true,
      data: {
        budgets: overview,
      },
      count: overview.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un budget pour l'utilisateur connecté (premium)
 *
 * DELETE /api/budgets/:id
 * Params: { id: string }
 */
export async function deleteBudgetController(
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

    if (!id) {
      throw createError("ID du budget requis", 400, "MISSING_BUDGET_ID");
    }

    // S'assurer que id est une string (req.params.id peut être string | string[])
    const budgetId = Array.isArray(id) ? id[0] : id;

    if (!budgetId) {
      throw createError("ID du budget requis", 400, "MISSING_BUDGET_ID");
    }

    await deleteBudgetById(userId, budgetId);

res.json(formatDatesToISO({
      success: true,
      message: "Budget supprimé avec succès",
      data: { id: budgetId },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère tous les budgets de l'utilisateur (tous types confondus)
 *
 * GET /api/budgets?type=CUSTOM&categoryId=xxx
 */
export async function getAllBudgetsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { type, categoryId, limit, offset } = req.query;

    const options: {
      type?: "MONTHLY" | "CUSTOM";
      categoryId?: string | null;
      limit?: number;
      offset?: number;
    } = {};

    if (type !== undefined) {
      if (type !== "MONTHLY" && type !== "CUSTOM") {
        throw createError(
          "Type de budget invalide. Doit être MONTHLY ou CUSTOM",
          400,
          "INVALID_BUDGET_TYPE"
        );
      }
      options.type = type as "MONTHLY" | "CUSTOM";
    }

    if (categoryId !== undefined) {
      options.categoryId = categoryId === "null" || categoryId === null ? null : String(categoryId);
    }

    if (limit !== undefined) {
      options.limit = Number(limit);
    }

    if (offset !== undefined) {
      options.offset = Number(offset);
    }

const budgets = await getAllBudgets(userId, options);

    res.json(formatDatesToISO({
      success: true,
      data: {
        budgets,
      },
      count: budgets.length,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie manuellement tous les budgets actifs de l'utilisateur
 * et déclenche les notifications si nécessaire.
 * 
 * POST /api/budgets/check
 * Headers: Authorization: Bearer <token>
 */
export async function checkBudgetsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const result = await checkAllBudgetsForUser(userId);

res.json(formatDatesToISO({
      success: true,
      message: "Vérification des budgets effectuée",
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}


