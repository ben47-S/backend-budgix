/**
 * Service de gestion des budgets (fonctionnalité premium)
 *
 * Permet aux utilisateurs premium de :
 * - Créer ou mettre à jour des budgets sur une période donnée
 * - Récupérer la progression des budgets (dépenses vs limite)
 * - Supprimer un budget
 * - Envoyer des notifications push quand un budget est presque atteint
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { sendBudgetWarning, sendBudgetAlert } from "./notification.service";
import logger from "../lib/logger";
import type { BudgetType, BudgetStatus } from "../../generated/prisma/client";

/**
 * Calcule le statut d'un budget en fonction de la période et des dépenses
 * 
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @param spentAmount - Montant dépensé
 * @param limitAmount - Montant limite du budget
 * @returns Le statut du budget (DÉPASSÉ, EN_COURS, À_VENIR)
 */
export function calculateBudgetStatus(
  periodStart: Date,
  periodEnd: Date,
  spentAmount: number,
  limitAmount: number
): BudgetStatus {
  const now = new Date();
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDateOnly = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
  const endDateOnly = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
  
  // Période à venir
  if (nowDateOnly < startDateOnly) {
    return "A_VENIR";
  }
  
  // Période passée
  if (nowDateOnly > endDateOnly) {
    return "DEPASSE";
  }
  
  // Période en cours
  // Si dépenses > limite, alors dépassé
  if (spentAmount > limitAmount) {
    return "DEPASSE";
  }
  
  // Sinon, en cours
  return "EN_COURS";
}

/**
 * Calcule les dates de début et fin d'un mois donné
 * 
 * @param year - Année
 * @param month - Mois (0-11, où 0 = janvier)
 * @returns Objet avec periodStart et periodEnd
 */
export function getMonthPeriod(year: number, month: number): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(year, month, 1);
  const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999); // Dernier jour du mois à 23:59:59.999
  return { periodStart, periodEnd };
}

/**
 * Crée ou met à jour un budget mensuel
 * 
 * @param options - Options pour créer le budget mensuel
 * @returns Le budget créé ou mis à jour
 */
export async function upsertMonthlyBudget(options: {
  userId: string;
  amount: number;
  year: number;
  month: number; // 0-11 (0 = janvier)
  categoryId?: string | null;
}) {
  const { userId, amount, year, month, categoryId = null } = options;
  
  const { periodStart, periodEnd } = getMonthPeriod(year, month);
  
  return upsertBudgetForPeriod({
    userId,
    amount,
    periodStart,
    periodEnd,
    categoryId,
    type: "MONTHLY",
  });
}

/**
 * Récupère tous les budgets d'un utilisateur (tous types confondus)
 * 
 * @param userId - ID de l'utilisateur
 * @param options - Options de filtrage
 * @returns Liste de tous les budgets avec progression et statut
 */
export async function getAllBudgets(
  userId: string,
  options?: {
    type?: BudgetType;
    categoryId?: string | null;
    limit?: number;
    offset?: number;
  }
) {
  // Construire la condition where
  const where: any = {
    userId,
  };
  
  if (options?.type !== undefined) {
    where.type = options.type;
  }
  
  if (options?.categoryId !== undefined) {
    where.categoryId = options.categoryId ?? null;
  }
  
  // Construire l'objet de requête conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
  const queryOptions: {
    where: any;
    include: {
      category: {
        select: {
          id: true;
          name: true;
        };
      };
    };
    orderBy: {
      periodStart: "desc";
    };
    take?: number;
    skip?: number;
  } = {
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
      periodStart: "desc",
    },
  };

  // Ajouter take et skip seulement s'ils sont définis
  if (options?.limit !== undefined) {
    queryOptions.take = options.limit;
  }
  if (options?.offset !== undefined) {
    queryOptions.skip = options.offset;
  }

  // Récupérer les budgets
  const budgets = await prisma.budget.findMany(queryOptions);
  
  // Calculer la progression pour chaque budget
  const budgetsWithProgress = await Promise.all(
    budgets.map(async (budget) => {
      const whereTransaction: any = {
        userId,
        date: {
          gte: budget.periodStart,
          lte: budget.periodEnd,
        },
      };
      
      if (budget.categoryId) {
        whereTransaction.categoryId = budget.categoryId;
      }
      
      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: whereTransaction,
      });
      
      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress = limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const status = calculateBudgetStatus(
        budget.periodStart,
        budget.periodEnd,
        spentAmount,
        limitAmount
      );
      
      return {
        id: budget.id,
        type: budget.type,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? "Toutes catégories",
        limitAmount,
        spentAmount,
        remainingAmount,
        progressPercent: progress,
        isOverLimit: spentAmount > limitAmount,
        status,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        ...(budget.type === "MONTHLY" && {
          year: budget.periodStart.getFullYear(),
          month: budget.periodStart.getMonth(),
        }),
      };
    })
  );
  
  return budgetsWithProgress;
}

/**
 * Récupère les budgets mensuels d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param options - Options de filtrage
 * @returns Liste des budgets mensuels avec progression et statut
 */
export async function getMonthlyBudgets(
  userId: string,
  options?: {
    year?: number;
    month?: number; // 0-11
    includePast?: boolean; // Inclure les mois passés
    categoryId?: string | null;
  }
) {
  const now = new Date();
  const currentYear = options?.year ?? now.getFullYear();
  const currentMonth = options?.month ?? now.getMonth();
  
  // Construire la condition where
  const where: any = {
    userId,
    type: "MONTHLY",
  };
  
  if (options?.categoryId !== undefined) {
    where.categoryId = options.categoryId ?? null;
  }
  
  // Si includePast est false ou non défini, ne récupérer que le mois en cours ou à venir
  if (!options?.includePast) {
    const { periodStart: currentMonthStart } = getMonthPeriod(currentYear, currentMonth);
    where.periodStart = {
      gte: currentMonthStart,
    };
  } else {
    // Si on veut inclure les mois passés, on peut filtrer par année si fournie
    if (options?.year !== undefined) {
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      where.periodStart = {
        gte: yearStart,
        lte: yearEnd,
      };
    }
  }
  
  // Récupérer les budgets
  const budgets = await prisma.budget.findMany({
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
      periodStart: "desc",
    },
  });
  
  // Calculer la progression pour chaque budget
  const budgetsWithProgress = await Promise.all(
    budgets.map(async (budget) => {
      const whereTransaction: any = {
        userId,
        date: {
          gte: budget.periodStart,
          lte: budget.periodEnd,
        },
      };
      
      if (budget.categoryId) {
        whereTransaction.categoryId = budget.categoryId;
      }
      
      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: whereTransaction,
      });
      
      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress = limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const status = calculateBudgetStatus(
        budget.periodStart,
        budget.periodEnd,
        spentAmount,
        limitAmount
      );
      
      return {
        id: budget.id,
        type: budget.type,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? "Toutes catégories",
        limitAmount,
        spentAmount,
        remainingAmount,
        progressPercent: progress,
        isOverLimit: spentAmount > limitAmount,
        status,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        year: budget.periodStart.getFullYear(),
        month: budget.periodStart.getMonth(),
      };
    })
  );
  
  return budgetsWithProgress;
}

/**
 * Crée ou met à jour un budget pour un utilisateur et une période donnée.
 *
 * Pour éviter les doublons, on considère qu'un budget est unique par :
 * - userId
 * - categoryId (ou null pour budget global)
 * - intervalle [periodStart, periodEnd]
 */
export async function upsertBudgetForPeriod(options: {
  userId: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  categoryId?: string | null;
  type?: BudgetType;
}) {
  const { userId, amount, periodStart, periodEnd, categoryId = null, type = "CUSTOM" } = options;

  if (periodStart > periodEnd) {
    throw createError(
      "La date de début doit être antérieure ou égale à la date de fin",
      400,
      "INVALID_BUDGET_PERIOD"
    );
  }

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isPremium: true },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Vérifier la catégorie si fournie
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

  // Chercher un budget existant pour la même combinaison (user, catégorie, période exacte, type)
  const existing = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId: categoryId ?? null,
      periodStart,
      periodEnd,
      type,
    },
  });

  let budget;
  let isUpdate = false;

  if (existing) {
    // Mise à jour du budget existant
    isUpdate = true;
    budget = await prisma.budget.update({
      where: { id: existing.id },
      data: {
        amount,
        type,
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
  } else {
    // Création d'un nouveau budget
    budget = await prisma.budget.create({
      data: {
        userId,
        categoryId: categoryId ?? null,
        amount,
        periodStart,
        periodEnd,
        type,
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
  }

  // Vérifier la progression du budget et envoyer une notification si nécessaire
  // (avec un délai de 15 secondes)
  logger.info('🔍 Démarrage de la vérification de notification pour le budget', {
    budgetId: budget.id,
    userId,
    limitAmount: amount,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    categoryId: categoryId ?? null,
    isUpdate,
  });

  checkBudgetAndScheduleNotification({
    budgetId: budget.id,
    userId,
    limitAmount: amount,
    periodStart,
    periodEnd,
    categoryId: categoryId ?? null,
    categoryName: budget.category?.name ?? null,
  })
    .then(() => {
      logger.debug('✅ Vérification de notification terminée (promesse résolue)', {
        budgetId: budget.id,
        userId,
      });
    })
    .catch((error) => {
      // Ne pas faire échouer la création/mise à jour du budget si la notification échoue
      logger.error("❌ Erreur lors de la vérification du budget pour notification", {
        budgetId: budget.id,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
      });
    });

  logger.info("✅ Budget créé/mis à jour - vérification de notification lancée", {
    budgetId: budget.id,
    userId,
    isUpdate,
    limitAmount: amount,
  });

  return budget;
}

/**
 * Récupère les budgets d'un utilisateur pour une période donnée
 * et calcule la progression (dépenses vs limite).
 *
 * Cette méthode est pensée pour alimenter l'écran "Rapports & Aperçus".
 */
export async function getBudgetsOverviewForPeriod(options: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const { userId, periodStart, periodEnd } = options;

  if (periodStart > periodEnd) {
    throw createError(
      "La date de début doit être antérieure ou égale à la date de fin",
      400,
      "INVALID_BUDGET_PERIOD"
    );
  }

  // Récupérer tous les budgets qui chevauchent (au moins en partie) la période demandée
  // Un budget chevauche la période si :
  // - Il commence avant ou pendant la période : periodStart <= periodEnd (de la requête)
  // - Il se termine après ou pendant la période : periodEnd >= periodStart (de la requête)
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      periodStart: {
        lte: periodEnd, // Le budget commence avant ou pendant la période demandée
      },
      periodEnd: {
        gte: periodStart, // Le budget se termine après ou pendant la période demandée
      },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (budgets.length === 0) {
    return [];
  }

  // Pour chaque budget, calculer les dépenses associées sur la période
  const overview = await Promise.all(
    budgets.map(async (budget) => {
      const where: any = {
        userId,
        date: {
          gte: budget.periodStart,
          lte: budget.periodEnd,
        },
      };

      // Budget par catégorie
      if (budget.categoryId) {
        where.categoryId = budget.categoryId;
      }

      // Somme des montants des transactions
      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where,
      });

      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress =
        limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const status = calculateBudgetStatus(
        budget.periodStart,
        budget.periodEnd,
        spentAmount,
        limitAmount
      );

      return {
        id: budget.id,
        type: budget.type,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? "Toutes catégories",
        limitAmount,
        spentAmount,
        remainingAmount,
        progressPercent: progress,
        isOverLimit: spentAmount > limitAmount,
        status,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };
    })
  );

  return overview;
}

/**
 * Supprime un budget pour un utilisateur donné.
 *
 * Vérifie que :
 * - L'utilisateur existe et est premium
 * - Le budget existe et appartient à l'utilisateur
 */
export async function deleteBudgetById(userId: string, budgetId: string) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isPremium: true },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Vérifier que le budget existe et appartient à l'utilisateur
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      userId,
    },
  });

  if (!budget) {
    throw createError(
      "Budget non trouvé ou vous n'avez pas l'autorisation de le supprimer",
      404,
      "BUDGET_NOT_FOUND"
    );
  }

  // Supprimer le budget
  await prisma.budget.delete({
    where: { id: budgetId },
  });

  return { id: budgetId };
}

/**
 * Vérifie tous les budgets d'un utilisateur pour une date donnée
 * et programme l'envoi de notifications si nécessaire.
 * 
 * Cette fonction est appelée après la création d'une transaction
 * pour vérifier si les budgets atteignent 70%.
 * 
 * @param userId - ID de l'utilisateur
 * @param transactionDate - Date de la transaction
 * @param categoryId - ID de la catégorie de la transaction (pour les budgets par catégorie)
 */
export async function checkBudgetsAfterTransaction(
  userId: string,
  transactionDate: Date,
  categoryId: string
) {
  logger.info('🔍 Vérification des budgets après création de transaction', {
    userId,
    transactionDate: transactionDate.toISOString(),
    categoryId,
  });

  // Récupérer tous les budgets de l'utilisateur qui incluent cette date
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      periodStart: {
        lte: transactionDate,
      },
      periodEnd: {
        gte: transactionDate,
      },
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

  logger.info('📊 Budgets trouvés pour cette date', {
    userId,
    transactionDate: transactionDate.toISOString(),
    budgetsCount: budgets.length,
  });

  // Vérifier chaque budget
  for (const budget of budgets) {
    // Vérifier si ce budget concerne cette transaction
    // - Budget global : concerne toutes les transactions
    // - Budget par catégorie : concerne uniquement les transactions de cette catégorie
    const isRelevant = !budget.categoryId || budget.categoryId === categoryId;

    if (!isRelevant) {
      logger.debug('⏭️  Budget ignoré (catégorie différente)', {
        budgetId: budget.id,
        budgetCategoryId: budget.categoryId,
        transactionCategoryId: categoryId,
      });
      continue;
    }

    // Vérifier ce budget
    await checkBudgetAndScheduleNotification({
      budgetId: budget.id,
      userId,
      limitAmount: Number(budget.amount),
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      categoryId: budget.categoryId,
      categoryName: budget.category?.name ?? null,
    }).catch((error) => {
      // Ne pas faire échouer la création de transaction si la vérification de budget échoue
      logger.error('❌ Erreur lors de la vérification du budget après transaction', {
        budgetId: budget.id,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    });
  }

  logger.info('✅ Vérification des budgets terminée', {
    userId,
    transactionDate: transactionDate.toISOString(),
    budgetsChecked: budgets.length,
  });
}

/**
 * Vérifie manuellement tous les budgets actifs d'un utilisateur
 * et programme l'envoi de notifications si nécessaire.
 * 
 * Cette fonction peut être appelée depuis le frontend pour forcer
 * une vérification des budgets (par exemple, après avoir consulté
 * la page des budgets).
 * 
 * @param userId - ID de l'utilisateur
 */
export async function checkAllBudgetsForUser(userId: string) {
  logger.info('🔍 Vérification manuelle de tous les budgets', {
    userId,
  });

  // Récupérer tous les budgets actifs de l'utilisateur
  // (budgets dont la période inclut la date actuelle)
  const now = new Date();
  
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      periodStart: {
        lte: now,
      },
      periodEnd: {
        gte: now,
      },
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

  logger.info('📊 Budgets actifs trouvés', {
    userId,
    budgetsCount: budgets.length,
    currentDate: now.toISOString(),
  });

  // Vérifier chaque budget
  const results = [];
  for (const budget of budgets) {
    try {
      await checkBudgetAndScheduleNotification({
        budgetId: budget.id,
        userId,
        limitAmount: Number(budget.amount),
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? null,
      });
      
      results.push({
        budgetId: budget.id,
        categoryName: budget.category?.name || "Toutes catégories",
        status: 'checked',
      });
    } catch (error) {
      logger.error('❌ Erreur lors de la vérification d\'un budget', {
        budgetId: budget.id,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
      
      results.push({
        budgetId: budget.id,
        categoryName: budget.category?.name || "Toutes catégories",
        status: 'error',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  logger.info('✅ Vérification manuelle terminée', {
    userId,
    budgetsChecked: budgets.length,
    resultsCount: results.length,
  });

  return {
    checked: results.length,
    budgets: results,
  };
}

/**
 * Vérifie la progression d'un budget et programme l'envoi d'une notification
 * si le budget est presque atteint (>= 70%) avec un délai de 15 secondes.
 * 
 * @param options - Options pour vérifier le budget
 */
async function checkBudgetAndScheduleNotification(options: {
  budgetId: string;
  userId: string;
  limitAmount: number;
  periodStart: Date;
  periodEnd: Date;
  categoryId: string | null;
  categoryName?: string | null;
}) {
  const { budgetId, userId, limitAmount, periodStart, periodEnd, categoryId, categoryName } = options;

  // Calculer les dépenses actuelles pour ce budget
  const where: any = {
    userId,
    date: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  // Budget par catégorie
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Somme des montants des transactions
  const aggregation = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where,
  });

  const spentAmount = Number(aggregation._sum.amount ?? 0);
  const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

  // Logger la progression du budget
  logger.info('📊 Vérification de la progression du budget', {
    budgetId,
    userId,
    budgetName: categoryName || "Toutes catégories",
    spentAmount,
    limitAmount,
    percentage: percentage.toFixed(2),
    isAlmostFull: percentage >= 70,
    isOverLimit: spentAmount >= limitAmount,
  });

  // Gérer trois cas :
  // 1. Budget entre 70% et 99.99% → Notification d'avertissement (programmée avec délai)
  // 2. Budget = 100% ou dépassé → Notification d'alerte (immédiate)
  
  if (spentAmount >= limitAmount) {
    // Budget atteint (100%) ou dépassé (> 100%)
    const budgetName = categoryName || "Toutes catégories";
    
    logger.warn('🚨 [ALERT] Budget atteint ou dépassé - Notification immédiate', {
      status: 'BUDGET_EXCEEDED',
      budgetId,
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
    });
    
    // Log supplémentaire très visible avec couleurs
    const red = '\x1b[31m';
    const reset = '\x1b[0m';
    console.log('\n' + red + '='.repeat(80) + reset);
    console.log(red + '🚨 [STATUS: BUDGET_EXCEEDED] BUDGET ATTEINT OU DÉPASSÉ - NOTIFICATION IMMÉDIATE' + reset);
    console.log(red + '='.repeat(80) + reset);
    console.log(`📊 Budget: ${budgetName}`);
    console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
    console.log(`📈 Pourcentage: ${percentage.toFixed(2)}%`);
    console.log(red + '='.repeat(80) + reset + '\n');
    
    // Envoyer immédiatement une notification d'alerte (pas de délai)
    const result = await sendBudgetAlert(
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      categoryName || undefined
    );
    
    if (result.sent) {
      logger.info("✅ [SUCCESS] Notification d'alerte de budget envoyée avec succès", {
        status: 'SUCCESS',
        userId,
        budgetId,
        budgetName,
        spentAmount,
        limitAmount,
        percentage: percentage.toFixed(2),
        tokensCount: result.count,
        ticketsCount: result.tickets?.length || 0,
        errorsCount: result.errors || 0,
      });
      // Log supplémentaire très visible avec couleurs
      const green = '\x1b[32m';
      const reset = '\x1b[0m';
      console.log('\n' + green + '='.repeat(80) + reset);
      console.log(green + '✅ [STATUS: SUCCESS] NOTIFICATION D\'ALERTE DE BUDGET ENVOYÉE AVEC SUCCÈS' + reset);
      console.log(green + '='.repeat(80) + reset);
      console.log(`📊 Budget: ${budgetName}`);
      console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
      console.log(`📈 Pourcentage: ${percentage.toFixed(2)}%`);
      console.log(`📱 Tokens: ${result.count} | Tickets: ${result.tickets?.length || 0} | Erreurs: ${result.errors || 0}`);
      console.log(green + '='.repeat(80) + reset + '\n');
    } else {
      logger.error("❌ [ERROR] Notification d'alerte de budget NON envoyée", {
        status: 'ERROR',
        userId,
        budgetId,
        budgetName,
        reason: result.reason,
        spentAmount,
        limitAmount,
        percentage: percentage.toFixed(2),
      });
      // Log supplémentaire très visible avec couleurs
      const red = '\x1b[31m';
      const reset = '\x1b[0m';
      console.log('\n' + red + '='.repeat(80) + reset);
      console.log(red + '❌ [STATUS: ERROR] NOTIFICATION D\'ALERTE DE BUDGET NON ENVOYÉE' + reset);
      console.log(red + '='.repeat(80) + reset);
      console.log(`📊 Budget: ${budgetName}`);
      console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
      console.log(`📈 Pourcentage: ${percentage.toFixed(2)}%`);
      console.log(`⚠️  Raison: ${result.reason}`);
      console.log(red + '='.repeat(80) + reset + '\n');
    }
  } else if (percentage >= 70) {
    // Budget entre 70% et 99.99% → Notification d'avertissement (programmée)
    const budgetName = categoryName || "Toutes catégories";

    logger.warn('⚠️  [WARN] Budget presque atteint - Notification programmée', {
      status: 'SCHEDULED',
      budgetId,
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
      delay: '15 secondes',
      timestamp: new Date().toISOString(),
    });
    // Log supplémentaire très visible avec couleurs
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    console.log('\n' + yellow + '='.repeat(80) + reset);
    console.log(yellow + '⚠️  [STATUS: SCHEDULED] BUDGET PRESQUE ATTEINT - NOTIFICATION PROGRAMMÉE' + reset);
    console.log(yellow + '='.repeat(80) + reset);
    console.log(`📊 Budget: ${budgetName}`);
    console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
    console.log(`📈 Pourcentage: ${percentage.toFixed(2)}% (seuil: >= 70%)`);
    console.log(`⏰ Notification sera envoyée dans: 15 secondes`);
    console.log(yellow + '='.repeat(80) + reset + '\n');

    // Programmer l'envoi de la notification avec un délai de 15 secondes (15 000 ms)
    const scheduledTime = new Date(Date.now() + 15 * 1000);
    const timeoutId = setTimeout(async () => {
      const now = new Date();
      logger.info('⏰ Délai de 15 secondes écoulé - Vérification avant envoi de notification', {
        budgetId,
        userId,
        budgetName,
        scheduledAt: scheduledTime.toISOString(),
        executedAt: now.toISOString(),
        delayMs: 15 * 1000,
      });
      try {
        // Vérifier à nouveau que le budget existe toujours et appartient toujours au même utilisateur
        // (important pour éviter d'envoyer des notifications à un autre utilisateur qui s'est connecté sur le même appareil)
        const budgetStillExists = await prisma.budget.findUnique({
          where: { id: budgetId },
          select: {
            id: true,
            userId: true,
          },
        });

        if (!budgetStillExists) {
          logger.warn('❌ Notification annulée - Budget supprimé', {
            budgetId,
            userId,
            budgetName,
          });
          return;
        }

        // Vérifier que le budget appartient toujours au même utilisateur
        // (protection contre les changements d'utilisateur sur le même appareil)
        if (budgetStillExists.userId !== userId) {
          logger.warn('❌ Notification annulée - Budget appartient à un autre utilisateur', {
            budgetId,
            originalUserId: userId,
            currentUserId: budgetStillExists.userId,
            budgetName,
          });
          return;
        }

        // Vérifier que l'utilisateur est toujours premium
        // (protection contre la perte du statut premium entre-temps)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isPremium: true },
        });

        if (!user) {
          logger.warn('❌ Notification annulée - Utilisateur non trouvé', {
            budgetId,
            userId,
            budgetName,
          });
          return;
        }

        if (!user.isPremium) {
          logger.warn('❌ Notification annulée - Utilisateur n\'est plus premium', {
            budgetId,
            userId,
            budgetName,
            isPremium: user.isPremium,
          });
          return;
        }

        // Recalculer les dépenses au moment de l'envoi
        const currentAggregation = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where,
        });

        const currentSpentAmount = Number(currentAggregation._sum.amount ?? 0);
        const currentPercentage = limitAmount > 0 ? (currentSpentAmount / limitAmount) * 100 : 0;

        logger.info('📊 Vérification finale avant envoi de notification', {
          budgetId,
          userId,
          budgetName,
          currentSpentAmount,
          limitAmount,
          currentPercentage: currentPercentage.toFixed(2),
          isInRange: currentPercentage >= 70 && currentSpentAmount < limitAmount,
        });

        // Gérer trois cas au moment de l'envoi :
        // 1. Budget entre 70% et 99.99% → Notification d'avertissement
        // 2. Budget = 100% ou dépassé → Notification d'alerte immédiate
        
        if (currentSpentAmount >= limitAmount) {
          // Budget atteint ou dépassé → Envoyer une alerte immédiate
          logger.warn('🚨 [ALERT] Budget atteint ou dépassé au moment de l\'envoi - Notification immédiate', {
            status: 'BUDGET_EXCEEDED',
            budgetId,
            userId,
            budgetName,
            currentSpentAmount,
            limitAmount,
            currentPercentage: currentPercentage.toFixed(2),
          });
          
          const result = await sendBudgetAlert(
            userId,
            budgetName,
            currentSpentAmount,
            limitAmount,
            categoryName || undefined
          );
          
          if (result.sent) {
            logger.info("✅ [SUCCESS] Notification d'alerte de budget envoyée avec succès", {
              status: 'SUCCESS',
              userId,
              budgetId,
              budgetName,
              spentAmount: currentSpentAmount,
              limitAmount,
              percentage: currentPercentage.toFixed(2),
              tokensCount: result.count,
              ticketsCount: result.tickets?.length || 0,
              errorsCount: result.errors || 0,
            });
            // Log supplémentaire très visible avec couleurs
            const green = '\x1b[32m';
            const reset = '\x1b[0m';
            console.log('\n' + green + '='.repeat(80) + reset);
            console.log(green + '✅ [STATUS: SUCCESS] NOTIFICATION D\'ALERTE DE BUDGET ENVOYÉE AVEC SUCCÈS' + reset);
            console.log(green + '='.repeat(80) + reset);
            console.log(`📊 Budget: ${budgetName}`);
            console.log(`💰 Dépenses: ${currentSpentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
            console.log(`📈 Pourcentage: ${currentPercentage.toFixed(2)}%`);
            console.log(`📱 Tokens: ${result.count} | Tickets: ${result.tickets?.length || 0} | Erreurs: ${result.errors || 0}`);
            console.log(green + '='.repeat(80) + reset + '\n');
          } else {
            logger.error("❌ [ERROR] Notification d'alerte de budget NON envoyée", {
              status: 'ERROR',
              userId,
              budgetId,
              budgetName,
              reason: result.reason,
              spentAmount: currentSpentAmount,
              limitAmount,
              percentage: currentPercentage.toFixed(2),
            });
            // Log supplémentaire très visible avec couleurs
            const red = '\x1b[31m';
            const reset = '\x1b[0m';
            console.log('\n' + red + '='.repeat(80) + reset);
            console.log(red + '❌ [STATUS: ERROR] NOTIFICATION D\'ALERTE DE BUDGET NON ENVOYÉE' + reset);
            console.log(red + '='.repeat(80) + reset);
            console.log(`📊 Budget: ${budgetName}`);
            console.log(`💰 Dépenses: ${currentSpentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
            console.log(`📈 Pourcentage: ${currentPercentage.toFixed(2)}%`);
            console.log(`⚠️  Raison: ${result.reason}`);
            console.log(red + '='.repeat(80) + reset + '\n');
          }
        } else if (currentPercentage >= 70) {
          // Budget entre 70% et 99.99% → Notification d'avertissement
          logger.info('🚀 [SENDING] Envoi de la notification de budget...', {
            status: 'SENDING',
            budgetId,
            userId,
            budgetName,
            currentSpentAmount,
            limitAmount,
            currentPercentage: currentPercentage.toFixed(2),
          });
          // Log supplémentaire très visible avec couleurs
          const cyan = '\x1b[36m';
          const reset = '\x1b[0m';
          console.log('\n' + cyan + '='.repeat(80) + reset);
          console.log(cyan + '🚀 [STATUS: SENDING] ENVOI DE NOTIFICATION DE BUDGET' + reset);
          console.log(cyan + '='.repeat(80) + reset);
          console.log(`📊 Budget: ${budgetName}`);
          console.log(`💰 Dépenses: ${currentSpentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
          console.log(`📈 Pourcentage: ${currentPercentage.toFixed(2)}%`);
          console.log(`⏰ Délai écoulé: 15 secondes`);
          console.log(cyan + '='.repeat(80) + reset + '\n');

          const result = await sendBudgetWarning(
            userId,
            budgetName,
            currentSpentAmount,
            limitAmount,
            currentPercentage
          );

          if (result.sent) {
            logger.info("✅ [SUCCESS] Notification de budget envoyée avec succès (15s après détection)", {
              status: 'SUCCESS',
              userId,
              budgetId,
              budgetName,
              spentAmount: currentSpentAmount,
              limitAmount,
              percentage: currentPercentage.toFixed(2),
              tokensCount: result.count,
              ticketsCount: result.tickets?.length || 0,
              errorsCount: result.errors || 0,
            });
            // Log supplémentaire très visible avec couleurs
            const green = '\x1b[32m';
            const reset = '\x1b[0m';
            console.log('\n' + green + '='.repeat(80) + reset);
            console.log(green + '✅ [STATUS: SUCCESS] NOTIFICATION DE BUDGET ENVOYÉE AVEC SUCCÈS' + reset);
            console.log(green + '='.repeat(80) + reset);
            console.log(`📊 Budget: ${budgetName}`);
            console.log(`💰 Dépenses: ${currentSpentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
            console.log(`📈 Pourcentage: ${currentPercentage.toFixed(2)}%`);
            console.log(`📱 Tokens: ${result.count} | Tickets: ${result.tickets?.length || 0} | Erreurs: ${result.errors || 0}`);
            console.log(green + '='.repeat(80) + reset + '\n');
          } else {
            logger.error("❌ [ERROR] Notification de budget NON envoyée", {
              status: 'ERROR',
              userId,
              budgetId,
              budgetName,
              reason: result.reason,
              spentAmount: currentSpentAmount,
              limitAmount,
              percentage: currentPercentage.toFixed(2),
            });
            // Log supplémentaire très visible avec couleurs
            const red = '\x1b[31m';
            const reset = '\x1b[0m';
            console.log('\n' + red + '='.repeat(80) + reset);
            console.log(red + '❌ [STATUS: ERROR] NOTIFICATION DE BUDGET NON ENVOYÉE' + reset);
            console.log(red + '='.repeat(80) + reset);
            console.log(`📊 Budget: ${budgetName}`);
            console.log(`💰 Dépenses: ${currentSpentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
            console.log(`📈 Pourcentage: ${currentPercentage.toFixed(2)}%`);
            console.log(`⚠️  Raison: ${result.reason}`);
            console.log(red + '='.repeat(80) + reset + '\n');
          }
        } else {
          logger.warn('❌ Notification annulée - Budget hors de la plage 70-100%', {
            budgetId,
            userId,
            budgetName,
            currentPercentage: currentPercentage.toFixed(2),
            currentSpentAmount,
            limitAmount,
            reason: currentPercentage < 70 
              ? 'Pourcentage inférieur à 70%' 
              : 'Budget déjà traité (atteint ou dépassé)',
          });
        }
      } catch (error) {
        logger.error("❌ Erreur lors de l'envoi de la notification de budget programmée", {
          budgetId,
          userId,
          budgetName,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }, 15 * 1000); // 15 secondes en millisecondes

    logger.info("✅ Notification de budget programmée avec setTimeout", {
      userId,
      budgetId,
      budgetName,
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
      delayMs: 15 * 1000,
      scheduledFor: scheduledTime.toISOString(),
      timeoutId: timeoutId.toString(),
    });
  } else {
    logger.info('ℹ️ Budget pas encore à 70% - Aucune notification programmée', {
      budgetId,
      userId,
      budgetName: categoryName || "Toutes catégories",
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
      reason: percentage < 70 ? 'Pourcentage inférieur à 70%' : 'Budget déjà dépassé',
    });
  }
}

