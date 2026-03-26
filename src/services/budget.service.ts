/**
 * Service de gestion des budgets (fonctionnalité premium)
 *
 * Permet aux utilisateurs premium de :
 * - Créer ou mettre à jour des budgets sur une période donnée
 * - Récupérer la progression des budgets (dépenses vs limite)
 * - Supprimer un budget
 * - Envoyer des notifications push quand un budget est presque atteint
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { sendBudgetWarning, sendBudgetAlert, sendBudgetWarningWithCustomMessage } from "./notification.service.js";
import logger from "../lib/logger.js";
import type { BudgetType, BudgetStatus } from "../generated/prisma/client.js";

/**
 * Vérifie la limite de budgets pour les utilisateurs gratuits
 *
 * @param userId - ID de l'utilisateur
 * @param budgetType - Type de budget (MONTHLY ou CUSTOM)
 * @param existingBudgetId - ID du budget existant (si mise à jour), pour l'exclure du comptage
 * @throws Erreur si la limite est atteinte
 */
async function checkBudgetLimit(userId: string, budgetType: BudgetType, existingBudgetId?: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true }
  });

  if (!user) throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  if (user.isPremium) return; // Premium = illimité

  // Compter budgets actifs de ce type (période non expirée)
  const now = new Date();
  const whereClause: any = {
    userId,
    type: budgetType,
    periodEnd: { gte: now }
  };

  // Exclure le budget existant si on est en train de le mettre à jour
  if (existingBudgetId) {
    whereClause.id = { not: existingBudgetId };
  }

  const activeCount = await prisma.budget.count({
    where: whereClause
  });

  if (activeCount >= 1) {
    const typeName = budgetType === "MONTHLY" ? "mensuel" : "personnalisé";
    throw createError(
      `Limite atteinte: 1 budget ${typeName} actif maximum.`,
      403,
      "BUDGET_LIMIT_REACHED",
      { type: budgetType, limit: 1, current: activeCount }
    );
  }
}

/**
 * Calcule le statut d'un budget en fonction de la période et des dépenses
 *
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @param spentAmount - Montant dépensé
 * @param limitAmount - Montant limite du budget
 * @returns Le statut du budget et le pourcentage de temps écoulé
 */
export function calculateBudgetStatus(
  periodStart: Date,
  periodEnd: Date,
  spentAmount: number,
  limitAmount: number
): { status: BudgetStatus; timeProgress: number } {
  const now = new Date();
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDateOnly = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
  const endDateOnly = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
  
  // Calculer le pourcentage de temps écoulé
  const totalDuration = endDateOnly.getTime() - startDateOnly.getTime();
  const elapsed = nowDateOnly.getTime() - startDateOnly.getTime();
  let timeProgress = 0;
  if (totalDuration > 0) {
    timeProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }
  
  // Période à venir
  if (nowDateOnly < startDateOnly) {
    return { status: "A_VENIR", timeProgress: 0 };
  }
  
  // Période passée
  if (nowDateOnly > endDateOnly) {
    return { status: "DEPASSE", timeProgress: 100 };
  }
  
  // Période en cours
  // Si dépenses > limite, alors dépassé
  if (spentAmount > limitAmount) {
    return { status: "DEPASSE", timeProgress };
  }
  
  // Sinon, en cours
  return { status: "EN_COURS", timeProgress };
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
        // Budget par catégorie : compter toutes les transactions de cette catégorie
        whereTransaction.categoryId = budget.categoryId;
      } else {
        // Budget global : compter uniquement les dépenses (catégories de type EXPENSE)
        // Note: Les montants sont toujours positifs, c'est le type de catégorie qui détermine si c'est une dépense
        whereTransaction.category = {
          type: "EXPENSE",
        };
      }

      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: whereTransaction,
      });

      // Les montants sont toujours positifs
      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress = limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const statusResult = calculateBudgetStatus(
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
        timeProgressPercent: statusResult.timeProgress,
        isOverLimit: spentAmount > limitAmount,
        status: statusResult.status,
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
        // Budget par catégorie : compter toutes les transactions de cette catégorie
        whereTransaction.categoryId = budget.categoryId;
      } else {
        // Budget global : compter uniquement les dépenses (catégories de type EXPENSE)
        // Note: Les montants sont toujours positifs, c'est le type de catégorie qui détermine si c'est une dépense
        whereTransaction.category = {
          type: "EXPENSE",
        };
      }

      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: whereTransaction,
      });

      // Les montants sont toujours positifs
      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress = limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const statusResult = calculateBudgetStatus(
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
        status: statusResult.status,
        timeProgressPercent: statusResult.timeProgress,
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

  // Vérifier la limite de budgets pour utilisateurs gratuits
  // Si on met à jour un budget existant, on exclut ce budget du comptage
  await checkBudgetLimit(userId, type, existing?.id);

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
      // Notification check completed
    })
    .catch((error) => {
      // Ne pas faire échouer la création/mise à jour du budget si la notification échoue
      logger.error("Erreur lors de la vérification du budget pour notification", {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    });

  // Calculer immédiatement le montant dépensé pour renvoyer des données complètes
  const whereTransaction: any = {
    userId,
    date: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  if (categoryId) {
    // Budget par catégorie : compter toutes les transactions de cette catégorie
    whereTransaction.categoryId = categoryId;
  } else {
    // Budget global : compter uniquement les dépenses (catégories de type EXPENSE)
    // Note: Les montants sont toujours positifs, c'est le type de catégorie qui détermine si c'est une dépense
    whereTransaction.category = {
      type: "EXPENSE",
    };
  }

  const aggregation = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: whereTransaction,
  });

  // Les montants sont toujours positifs
  const spentAmount = Number(aggregation._sum.amount ?? 0);
  const limitAmount = Number(budget.amount);
  const remainingAmount = limitAmount - spentAmount;
  const progress = limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
  const statusResult = calculateBudgetStatus(
    budget.periodStart,
    budget.periodEnd,
    spentAmount,
    limitAmount
  );

  // Retourner le budget avec les données de progression calculées
  return {
    ...budget,
    limitAmount,
    spentAmount,
    remainingAmount,
    progressPercent: progress,
    timeProgressPercent: statusResult.timeProgress,
    isOverLimit: spentAmount > limitAmount,
    status: statusResult.status,
  };
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

      if (budget.categoryId) {
        // Budget par catégorie : compter toutes les transactions de cette catégorie
        where.categoryId = budget.categoryId;
      } else {
        // Budget global : compter uniquement les dépenses (catégories de type EXPENSE)
        // Note: Les montants sont toujours positifs, c'est le type de catégorie qui détermine si c'est une dépense
        where.category = {
          type: "EXPENSE",
        };
      }

      // Somme des montants des transactions
      const aggregation = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where,
      });

      // Les montants sont toujours positifs
      const spentAmount = Number(aggregation._sum.amount ?? 0);
      const limitAmount = Number(budget.amount);
      const remainingAmount = limitAmount - spentAmount;
      const progress =
        limitAmount > 0 ? Math.min(100, (spentAmount / limitAmount) * 100) : 0;
      const statusResult = calculateBudgetStatus(
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
        status: statusResult.status,
        timeProgressPercent: statusResult.timeProgress,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };
    })
  );

  return overview;
}

/**
 * Supprime un budget par son ID
 * 
 * Préconditions:
 * - L'utilisateur existe
 * - Le budget existe et appartient à l'utilisateur
 */
export async function deleteBudgetById(userId: string, budgetId: string) {
  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
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

  // Vérifier chaque budget
  for (const budget of budgets) {
    // Vérifier si ce budget concerne cette transaction
    // - Budget global : concerne toutes les transactions
    // - Budget par catégorie : concerne uniquement les transactions de cette catégorie
    const isRelevant = !budget.categoryId || budget.categoryId === categoryId;

    if (!isRelevant) {
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
      logger.error('Erreur lors de la vérification du budget après transaction', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    });
  }
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
 * Vérifie si un seuil de notification a déjà été envoyé pour ce budget
 *
 * @param budgetId - ID du budget
 * @param threshold - Seuil à vérifier (80, 95, 100)
 * @returns true si le seuil a déjà été notifié
 */
async function isThresholdAlreadyNotified(budgetId: string, threshold: number): Promise<boolean> {
  const existing = await prisma.budgetNotificationThreshold.findUnique({
    where: {
      budgetId_threshold: {
        budgetId,
        threshold,
      },
    },
  });
  return existing !== null;
}

/**
 * Enregistre qu'un seuil de notification a été envoyé pour ce budget
 *
 * @param budgetId - ID du budget
 * @param threshold - Seuil notifié (80, 95, 100)
 */
async function markThresholdAsNotified(budgetId: string, threshold: number): Promise<void> {
  await prisma.budgetNotificationThreshold.upsert({
    where: {
      budgetId_threshold: {
        budgetId,
        threshold,
      },
    },
    create: {
      budgetId,
      threshold,
    },
    update: {
      notifiedAt: new Date(),
    },
  });
}

/**
 * Détermine le seuil de notification le plus élevé à envoyer
 * en évitant les doublons
 *
 * @param percentage - Pourcentage actuel du budget
 * @param budgetId - ID du budget
 * @returns Le seuil à notifier ou null si aucun
 */
async function determineThresholdToNotify(
  percentage: number,
  budgetId: string
): Promise<number | null> {
  // Déterminer tous les seuils atteints
  const reachedThresholds: number[] = [];
  if (percentage >= 80) reachedThresholds.push(80);
  if (percentage >= 95) reachedThresholds.push(95);
  if (percentage >= 100) reachedThresholds.push(100);

  // Si aucun seuil atteint, pas de notification
  if (reachedThresholds.length === 0) return null;

  // Vérifier quels seuils n'ont pas encore été notifiés (du plus élevé au plus bas)
  for (let i = reachedThresholds.length - 1; i >= 0; i--) {
    const threshold = reachedThresholds[i];
    if (threshold === undefined) continue; // Type guard

    const alreadyNotified = await isThresholdAlreadyNotified(budgetId, threshold);

    if (!alreadyNotified) {
      // Retourner le seuil le plus élevé non encore notifié
      return threshold;
    }
  }

  // Tous les seuils ont déjà été notifiés
  return null;
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

  if (categoryId) {
    // Budget par catégorie : compter toutes les transactions de cette catégorie
    where.categoryId = categoryId;
  } else {
    // Budget global : compter uniquement les dépenses (catégories de type EXPENSE)
    // Note: Les montants sont toujours positifs, c'est le type de catégorie qui détermine si c'est une dépense
    where.category = {
      type: "EXPENSE",
    };
  }

  // Somme des montants des transactions
  const aggregation = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where,
  });

  // Les montants sont toujours positifs
  const spentAmount = Number(aggregation._sum.amount ?? 0);
  const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

  // Déterminer le seuil de notification à envoyer
  const thresholdToNotify = await determineThresholdToNotify(percentage, budgetId);

  // Gérer trois seuils de notification :
  // 1. 80% : Notification d'avertissement (programmée avec délai)
  // 2. 95% : Notification d'avertissement critique (programmée avec délai)
  // 3. 100% : Notification d'alerte (immédiate)

  if (thresholdToNotify === null) {
    // Aucun nouveau seuil à notifier
    return;
  }

  const budgetName = categoryName || "Toutes catégories";

  // Traiter le seuil de 100% (alerte immédiate)
  if (thresholdToNotify === 100) {
    logger.warn('🚨 [ALERT] Budget atteint ou dépassé - Notification immédiate', {
      status: 'BUDGET_EXCEEDED',
      budgetId,
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
      threshold: 100,
    });

    // Log coloré
    const red = '\x1b[31m';
    const reset = '\x1b[0m';
    console.log('\n' + red + '='.repeat(80) + reset);
    console.log(red + '🚨 [THRESHOLD: 100%] BUDGET ATTEINT OU DÉPASSÉ - NOTIFICATION IMMÉDIATE' + reset);
    console.log(red + '='.repeat(80) + reset);
    console.log(`📊 Budget: ${budgetName}`);
    console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
    console.log(`📈 Pourcentage: ${percentage.toFixed(2)}%`);
    console.log(red + '='.repeat(80) + reset + '\n');

    // Envoyer immédiatement une notification d'alerte
    const result = await sendBudgetAlert(
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      categoryName || undefined
    );

    if (result.sent) {
      // Marquer le seuil comme notifié
      await markThresholdAsNotified(budgetId, 100);
      logger.info("Notification d'alerte 100% envoyée");
    } else {
      logger.error("Notification d'alerte 100% NON envoyée", {
        status: 'ERROR',
        userId,
        budgetId,
        budgetName,
        threshold: 100,
        reason: result.reason,
      });
    }
    return;
  }

  // Traiter les seuils de 80% et 95% (avertissements programmés)
  if (thresholdToNotify === 80 || thresholdToNotify === 95) {
    const isHighThreshold = thresholdToNotify === 95;
    const logColor = isHighThreshold ? '\x1b[33m' : '\x1b[35m'; // Jaune pour 95%, Magenta pour 80%
    const reset = '\x1b[0m';

    logger.warn(`⚠️  [WARN] Budget à ${thresholdToNotify}% - Notification programmée`, {
      status: 'SCHEDULED',
      budgetId,
      userId,
      budgetName,
      spentAmount,
      limitAmount,
      percentage: percentage.toFixed(2),
      threshold: thresholdToNotify,
      delay: '15 secondes',
    });

    // Log coloré
    console.log('\n' + logColor + '='.repeat(80) + reset);
    console.log(logColor + `⚠️  [THRESHOLD: ${thresholdToNotify}%] BUDGET PRESQUE ATTEINT - NOTIFICATION PROGRAMMÉE` + reset);
    console.log(logColor + '='.repeat(80) + reset);
    console.log(`📊 Budget: ${budgetName}`);
    console.log(`💰 Dépenses: ${spentAmount.toLocaleString()} FCFA / ${limitAmount.toLocaleString()} FCFA`);
    console.log(`📈 Pourcentage: ${percentage.toFixed(2)}% (seuil: ${thresholdToNotify}%)`);
    console.log(`⏰ Notification sera envoyée dans: 15 secondes`);
    console.log(logColor + '='.repeat(80) + reset + '\n');

    // Programmer l'envoi avec délai de 15 secondes
    setTimeout(async () => {
      try {
        // Vérifications de sécurité (budget existe, utilisateur toujours premium, etc.)
        const budgetStillExists = await prisma.budget.findUnique({
          where: { id: budgetId },
          select: { id: true, userId: true },
        });

        if (!budgetStillExists) {
          logger.warn('❌ Notification annulée - Budget supprimé', { budgetId });
          return;
        }

        if (budgetStillExists.userId !== userId) {
          logger.warn('❌ Notification annulée - Budget appartient à un autre utilisateur', { budgetId });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isPremium: true },
        });

        if (!user || !user.isPremium) {
          logger.warn('❌ Notification annulée - Utilisateur non premium', { budgetId, userId });
          return;
        }

        // Vérifier que le seuil n'a pas déjà été notifié entre temps
        const alreadyNotified = await isThresholdAlreadyNotified(budgetId, thresholdToNotify);
        if (alreadyNotified) {
          logger.info('ℹ️ Notification annulée - Seuil déjà notifié', {
            budgetId,
            threshold: thresholdToNotify,
          });
          return;
        }

        // Recalculer les dépenses au moment de l'envoi
        const currentAggregation = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where,
        });

        // Les dépenses sont négatives, on prend la valeur absolue
        const currentSpentAmount = Math.abs(Number(currentAggregation._sum.amount ?? 0));
        const currentPercentage = limitAmount > 0 ? (currentSpentAmount / limitAmount) * 100 : 0;

        // Vérifier que le pourcentage est toujours dans la plage appropriée
        if (currentPercentage < thresholdToNotify) {
          logger.warn('❌ Notification annulée - Pourcentage inférieur au seuil', {
            budgetId,
            threshold: thresholdToNotify,
            currentPercentage: currentPercentage.toFixed(2),
          });
          return;
        }

        // Si le budget a atteint 100% entre temps, envoyer une alerte au lieu d'un warning
        if (currentSpentAmount >= limitAmount) {
          const alertResult = await sendBudgetAlert(
            userId,
            budgetName,
            currentSpentAmount,
            limitAmount,
            categoryName || undefined
          );

          if (alertResult.sent) {
            await markThresholdAsNotified(budgetId, 100);
            logger.info("✅ Notification d'alerte 100% envoyée (upgrade depuis warning)", {
              userId,
              budgetId,
              originalThreshold: thresholdToNotify,
              finalThreshold: 100,
            });
          }
          return;
        }

        // Déterminer le titre et le corps du message selon le seuil
        let customTitle: string;
        let customBody: string;

        if (thresholdToNotify === 80) {
          customTitle = 'Attention budget';
          customBody = `Votre budget "${budgetName}" atteint 80% : ${currentSpentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA`;
        } else { // 95%
          customTitle = 'Alerte budget critique';
          customBody = `Votre budget "${budgetName}" atteint 95% : ${currentSpentAmount.toFixed(2)} FCFA / ${limitAmount.toFixed(2)} FCFA. Attention au dépassement !`;
        }

        // Envoyer la notification avec le message personnalisé
        const result = await sendBudgetWarningWithCustomMessage(
          userId,
          customTitle,
          customBody,
          budgetName,
          currentSpentAmount,
          limitAmount,
          currentPercentage
        );

        if (result.sent) {
          // Marquer le seuil comme notifié
          await markThresholdAsNotified(budgetId, thresholdToNotify);
          logger.info(`Notification de ${thresholdToNotify}% envoyée`);
        } else {
          logger.error(`Notification de ${thresholdToNotify}% NON envoyée: ${result.reason}`);
        }
      } catch (error) {
        logger.error("Erreur lors de l'envoi de la notification programmée", {
          threshold: thresholdToNotify,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }, 15 * 1000);

    logger.info("✅ Notification programmée avec setTimeout", {
      userId,
      budgetId,
      budgetName,
      threshold: thresholdToNotify,
      delayMs: 15 * 1000,
    });
  }
}

