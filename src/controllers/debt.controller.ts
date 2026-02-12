/**
 * Contrôleurs pour la gestion des dettes (fonctionnalité premium)
 * 
 * Gère :
 * - La création de dettes
 * - La récupération des dettes (avec filtres)
 * - La mise à jour des dettes
 * - La suppression de dettes
 * - Les statistiques des dettes
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler";
import {
  createDebt,
  getDebts,
  getDebtById,
  updateDebt,
  deleteDebt,
  getDebtStats,
} from "../services/debt.service";
import { formatDatesToISO } from "../utils/date-formatter";
import type { CreateDebtRequest, UpdateDebtRequest } from "../types";
import type { DebtType } from "../../generated/prisma/client";

/**
 * Crée une nouvelle dette
 * 
 * POST /api/debts
 * Headers: Authorization: Bearer <token>
 * Body: { type: "OWED_TO_ME" | "I_OWE", contactName: string, amount: number, notes?: string }
 */
export async function createDebtController(
  req: Request<{}, {}, CreateDebtRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { type, contactName, amount, notes } = req.body;

    // Valider le type
    if (!type || (type !== "OWED_TO_ME" && type !== "I_OWE")) {
      throw createError(
        "Type de dette invalide. Doit être OWED_TO_ME ou I_OWE",
        400,
        "INVALID_DEBT_TYPE"
      );
    }

    const debt = await createDebt(userId, type, contactName, amount, notes);

res.status(201).json(formatDatesToISO({
      success: true,
      message: "Dette créée avec succès",
      data: {
        debt,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère toutes les dettes de l'utilisateur connecté
 * 
 * GET /api/debts?type=OWED_TO_ME&isPaid=false
 * Headers: Authorization: Bearer <token>
 */
export async function getDebtsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { type, isPaid } = req.query;

    // Valider et convertir les paramètres de requête
    let debtType: DebtType | undefined;
    if (type) {
      if (type !== "OWED_TO_ME" && type !== "I_OWE") {
        throw createError(
          "Type de dette invalide. Doit être OWED_TO_ME ou I_OWE",
          400,
          "INVALID_DEBT_TYPE"
        );
      }
      debtType = type as DebtType;
    }

    let isPaidFilter: boolean | undefined;
    if (isPaid !== undefined) {
      if (isPaid === "true") {
        isPaidFilter = true;
      } else if (isPaid === "false") {
        isPaidFilter = false;
      } else {
        throw createError(
          "Paramètre isPaid invalide. Doit être 'true' ou 'false'",
          400,
          "INVALID_IS_PAID"
        );
      }
    }

    const debts = await getDebts(userId, debtType, isPaidFilter);

res.json(formatDatesToISO({
      success: true,
      data: {
        debts,
        count: debts.length,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère une dette par son ID
 * 
 * GET /api/debts/:id
 * Headers: Authorization: Bearer <token>
 */
export async function getDebtByIdController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;

    const debt = await getDebtById(id, userId);

res.json(formatDatesToISO({
      success: true,
      data: {
        debt,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour une dette
 * 
 * PUT /api/debts/:id
 * Headers: Authorization: Bearer <token>
 * Body: { type?: "OWED_TO_ME" | "I_OWE", contactName?: string, amount?: number, isPaid?: boolean, notes?: string }
 */
export async function updateDebtController(
  req: Request<{ id: string }, {}, UpdateDebtRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;
    const updates = req.body;

    // Valider le type si fourni
    if (updates.type && updates.type !== "OWED_TO_ME" && updates.type !== "I_OWE") {
      throw createError(
        "Type de dette invalide. Doit être OWED_TO_ME ou I_OWE",
        400,
        "INVALID_DEBT_TYPE"
      );
    }

    const updatedDebt = await updateDebt(id, userId, updates);

res.json(formatDatesToISO({
      success: true,
      message: "Dette mise à jour avec succès",
      data: {
        debt: updatedDebt,
      },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une dette
 * 
 * DELETE /api/debts/:id
 * Headers: Authorization: Bearer <token>
 */
export async function deleteDebtController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { id } = req.params;

    await deleteDebt(id, userId);

res.json(formatDatesToISO({
      success: true,
      message: "Dette supprimée avec succès",
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques des dettes de l'utilisateur connecté
 * 
 * GET /api/debts/stats
 * Headers: Authorization: Bearer <token>
 */
export async function getDebtStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const stats = await getDebtStats(userId);

res.json(formatDatesToISO({
      success: true,
      data: {
        stats,
      },
    }));
  } catch (error) {
    next(error);
  }
}

