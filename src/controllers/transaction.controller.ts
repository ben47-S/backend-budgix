/**
 * Contrôleur de gestion des transactions
 * 
 * Gère les requêtes HTTP liées aux transactions :
 * - Liste des transactions avec filtres
 * - Création de transactions
 * - Résumé des transactions (totaux)
 */

import type { Request, Response, NextFunction } from "express";
import {
  createTransaction,
  getTransactions,
  getTransactionSummary,
  deleteAllUserTransactions,
} from "../services/transaction.service";
import { createError } from "../middleware/errorHandler";
import { logEvent } from "../services/log.service";
import type { CreateTransactionRequest, PeriodFilter } from "../types/index";
import { formatDatesInObject } from "../utils/date-formatter";

/**
 * Récupère les transactions de l'utilisateur connecté
 * 
 * GET /api/transactions
 * Query params:
 *   - period: week|month|year (optionnel)
 *   - categoryId: string (optionnel)
 *   - limit: number (optionnel)
 *   - offset: number (optionnel)
 */
export async function getTransactionsController(
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

    // Récupérer les paramètres de requête
    const period = req.query.period as PeriodFilter | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

    // Valider la période si fournie
    if (period && !["week", "month", "year"].includes(period)) {
      throw createError(
        "Période invalide. Valeurs acceptées : week, month, year",
        400,
        "INVALID_PERIOD"
      );
    }

    const transactions = await getTransactions(userId, period, categoryId, limit, offset);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length,
      ...(period && { period }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crée une nouvelle transaction
 * 
 * POST /api/transactions
 * Body: { amount: number, categoryId: string, date: string|Date, time?: string, note?: string }
 */
export async function createTransactionController(
  req: Request<{}, {}, CreateTransactionRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    // Récupérer userId depuis le token JWT (défini par requireAuth)
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { amount, categoryId, date, time, note } = req.body;

    // Valider les données d'entrée
    if (!amount || typeof amount !== "number") {
      throw createError("Le montant est requis et doit être un nombre", 400, "AMOUNT_REQUIRED");
    }

    if (!categoryId || typeof categoryId !== "string") {
      throw createError("L'ID de la catégorie est requis", 400, "CATEGORY_ID_REQUIRED");
    }

    if (!date) {
      throw createError("La date est requise", 400, "DATE_REQUIRED");
    }

    // Valider le format de l'heure si fournie
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      throw createError(
        "Format d'heure invalide. Format attendu : HH:mm",
        400,
        "INVALID_TIME_FORMAT"
      );
    }

    const transaction = await createTransaction(
      userId,
      amount,
      categoryId,
      date,
      time,
      note
    );

    // Logger la création de la transaction
    logEvent({
      level: "INFO",
      scope: "BUSINESS",
      action: "TRANSACTION_CREATED",
      userId: userId,
      targetId: transaction.id,
      metadata: {
        amount,
        categoryId,
        date,
        hasNote: !!note,
      },
    });

    res.status(201).json(formatDatesInObject({
      success: true,
      message: "Transaction créée avec succès",
      data: transaction,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère le résumé des transactions (totaux)
 * 
 * GET /api/transactions/summary
 * Query params:
 *   - period: week|month|year (optionnel)
 */
export async function getTransactionSummaryController(
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

    const period = req.query.period as PeriodFilter | undefined;

    // Valider la période si fournie
    if (period && !["week", "month", "year"].includes(period)) {
      throw createError(
        "Période invalide. Valeurs acceptées : week, month, year",
        400,
        "INVALID_PERIOD"
      );
    }

    const summary = await getTransactionSummary(userId, period);

    res.json(formatDatesInObject({
      success: true,
      data: summary,
      ...(period && { period }),
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime toutes les transactions de l'utilisateur connecté
 * 
 * ⚠️ ATTENTION : Cette opération est irréversible !
 * 
 * DELETE /api/transactions/all
 * Body: { confirm: true } (requis pour confirmer la suppression)
 */
export async function deleteAllTransactionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { confirm } = req.body;

    // Vérifier que l'utilisateur a confirmé la suppression
    if (confirm !== true) {
      throw createError(
        "Confirmation requise. Vous devez confirmer la suppression en envoyant { confirm: true }",
        400,
        "CONFIRMATION_REQUIRED"
      );
    }

    const result = await deleteAllUserTransactions(userId);

    res.json(formatDatesInObject({
      success: true,
      message: result.message,
      data: {
        deletedCount: result.count,
      },
    }));
  } catch (error) {
    next(error);
  }
}

