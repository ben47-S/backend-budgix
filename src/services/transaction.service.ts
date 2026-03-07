/**
 * Service de gestion des transactions
 * 
 * Ce service gère :
 * - La création de transactions (entrées/sorties)
 * - La récupération des transactions avec filtres
 * - Le calcul des totaux (dépenses, revenus, différence)
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { getPeriodDates, buildTransactionDate } from "../utils/date.js";
import type { PeriodFilter } from "../types/index.js";
import type { CategoryType } from "../generated/prisma/client.js";
import { checkBudgetsAfterTransaction } from "./budget.service.js";
import logger from "../lib/logger.js";

/**
 * Crée une nouvelle transaction
 * 
 * @param userId - ID de l'utilisateur
 * @param amount - Montant de la transaction
 * @param categoryId - ID de la catégorie
 * @param date - Date de la transaction (peut être string ou Date)
 * @param time - Heure optionnelle (format "HH:mm")
 * @param note - Note optionnelle
 * @returns La transaction créée
 */
export async function createTransaction(
  userId: string,
  amount: number,
  categoryId: string,
  date: Date | string,
  time?: string,
  note?: string
) {
  // Valider le montant
  if (!amount || amount <= 0) {
    throw createError("Le montant doit être supérieur à 0", 400, "INVALID_AMOUNT");
  }

  // Vérifier que la catégorie existe et appartient à l'utilisateur ou est globale
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [
        { userId: null }, // Catégorie globale
        { userId }, // Catégorie de l'utilisateur
      ],
    },
  });

  if (!category) {
    throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
  }

  // Construire la date complète avec l'heure si fournie
  const transactionDate = buildTransactionDate(date, time);

  // Créer la transaction
  const transaction = await prisma.transaction.create({
    data: {
      amount,
      categoryId,
      userId,
      date: transactionDate,
      note: note?.trim() || null,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  // Vérifier les budgets après la création de la transaction
  // (en arrière-plan pour ne pas bloquer la réponse)
  checkBudgetsAfterTransaction(userId, transactionDate, categoryId)
    .then(() => {
      logger.debug('✅ Vérification des budgets terminée après création de transaction', {
        transactionId: transaction.id,
        userId,
      });
    })
    .catch((error) => {
      // Ne pas faire échouer la création de transaction si la vérification de budget échoue
      logger.error('❌ Erreur lors de la vérification des budgets après création de transaction', {
        transactionId: transaction.id,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    });

  return transaction;
}

/**
 * Récupère les transactions d'un utilisateur avec filtres optionnels
 * 
 * @param userId - ID de l'utilisateur
 * @param period - Période de filtrage (week, month, year) - optionnel
 * @param categoryId - ID de la catégorie pour filtrer - optionnel
 * @param limit - Nombre maximum de résultats - optionnel
 * @param offset - Décalage pour la pagination - optionnel
 * @returns Liste des transactions
 */
export async function getTransactions(
  userId: string,
  period?: PeriodFilter,
  categoryId?: string,
  limit?: number,
  offset?: number
) {
  const where: any = {
    userId,
  };

  // Filtrer par période si fournie
  if (period) {
    const { startDate, endDate } = getPeriodDates(period);
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Filtrer par catégorie si fournie
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Construire l'objet de requête conditionnellement pour éviter undefined
  const queryOptions: any = {
    where,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: {
      date: "desc", // Plus récentes en premier
    },
  };

  // Ajouter limit et offset seulement s'ils sont définis
  if (limit !== undefined) {
    queryOptions.take = limit;
  }
  if (offset !== undefined) {
    queryOptions.skip = offset;
  }

  const transactions = await prisma.transaction.findMany(queryOptions);

  return transactions;
}

/**
 * Calcule les totaux (dépenses, revenus, différence) pour un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param period - Période de filtrage (week, month, year) - optionnel
 * @returns Objet avec les totaux
 */
export async function getTransactionSummary(
  userId: string,
  period?: PeriodFilter
) {
  const where: any = {
    userId,
  };

  // Filtrer par période si fournie
  if (period) {
    const { startDate, endDate } = getPeriodDates(period);
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Récupérer toutes les transactions avec leurs catégories
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      category: {
        select: {
          type: true,
        },
      },
    },
  });

  // Calculer les totaux
  let totalIncome = 0;
  let totalExpense = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.category.type === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  }

  const difference = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    difference,
    transactionCount: transactions.length,
  };
}

/**
 * Récupère une transaction par son ID
 * 
 * @param transactionId - ID de la transaction
 * @param userId - ID de l'utilisateur
 * @returns La transaction trouvée
 */
export async function getTransactionById(transactionId: string, userId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!transaction) {
    throw createError("Transaction non trouvée", 404, "TRANSACTION_NOT_FOUND");
  }

  return transaction;
}

/**
 * Supprime toutes les transactions d'un utilisateur
 * 
 * ⚠️ ATTENTION : Cette opération est irréversible !
 * 
 * @param userId - ID de l'utilisateur
 * @returns Nombre de transactions supprimées
 */
export async function deleteAllUserTransactions(userId: string) {
  // Compter d'abord le nombre de transactions avant suppression
  const countBefore = await prisma.transaction.count({
    where: { userId },
  });

  if (countBefore === 0) {
    return { count: 0, message: "Aucune transaction à supprimer" };
  }

  // Supprimer toutes les transactions de l'utilisateur
  const result = await prisma.transaction.deleteMany({
    where: { userId },
  });

  logger.info("🗑️ Toutes les transactions supprimées pour un utilisateur", {
    userId,
    deletedCount: result.count,
    countBefore,
  });

  return {
    count: result.count,
    message: `${result.count} transaction(s) supprimée(s) avec succès`,
  };
}

