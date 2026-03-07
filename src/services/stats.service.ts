/**
 * Service de gestion des statistiques
 * 
 * Ce service gère :
 * - Les statistiques globales depuis l'inscription (dépenses, revenus)
 * - Le top des catégories de dépenses et revenus les plus utilisées
 *   - Premium : top 3 dépenses + top 3 revenus
 *   - Non premium : top 2 dépenses seulement
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";

/**
 * Récupère les statistiques complètes d'un utilisateur depuis son inscription
 * 
 * @param userId - ID de l'utilisateur
 * @returns Statistiques complètes (totaux, top catégories)
 * 
 * Comportement selon le statut premium :
 * - Premium : top 3 catégories de dépenses + top 3 catégories de revenus
 * - Non premium : top 2 catégories de dépenses seulement
 */
export async function getUserStats(userId: string) {
  // Vérifier que l'utilisateur existe et récupérer son statut premium
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      isPremium: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // Récupérer toutes les transactions de l'utilisateur
  const transactions = await prisma.transaction.findMany({
    where: {
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

  // Calculer les totaux depuis l'inscription
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

  const isPremium = user.isPremium;
  const topLimit = isPremium ? 3 : 2; // Top 3 pour premium, top 2 pour non premium

  // Calculer le top des catégories de dépenses les plus utilisées
  const expenseTransactions = transactions.filter(
    (t) => t.category.type === "EXPENSE"
  );

  // Compter les occurrences par catégorie de dépenses
  const expenseCategoryCounts = new Map<string, { name: string; count: number; totalAmount: number }>();

  for (const transaction of expenseTransactions) {
    const categoryId = transaction.categoryId;
    const categoryName = transaction.category.name;
    const amount = Number(transaction.amount);

    if (expenseCategoryCounts.has(categoryId)) {
      const existing = expenseCategoryCounts.get(categoryId)!;
      existing.count += 1;
      existing.totalAmount += amount;
    } else {
      expenseCategoryCounts.set(categoryId, {
        name: categoryName,
        count: 1,
        totalAmount: amount,
      });
    }
  }

  // Convertir en tableau et trier par montant total (décroissant) pour classer par pourcentage
  const topExpenseCategories = Array.from(expenseCategoryCounts.values())
    .sort((a, b) => b.totalAmount - a.totalAmount) // Trier par montant total (pas par nombre de transactions)
    .slice(0, topLimit)
    .map((cat) => {
      // Calculer le pourcentage par rapport au total des dépenses
      const percentage = totalExpense > 0 ? (cat.totalAmount / totalExpense) * 100 : 0;
      return {
        name: cat.name,
        transactionCount: cat.count,
        totalAmount: cat.totalAmount,
        percentage: Math.round(percentage * 100) / 100, // Arrondir à 2 décimales
      };
    });

  // Pour les utilisateurs premium, calculer aussi le top des catégories de revenus
  let topIncomeCategories: Array<{ name: string; transactionCount: number; totalAmount: number }> = [];

  if (isPremium) {
    const incomeTransactions = transactions.filter(
      (t) => t.category.type === "INCOME"
    );

    // Compter les occurrences par catégorie de revenus
    const incomeCategoryCounts = new Map<string, { name: string; count: number; totalAmount: number }>();

    for (const transaction of incomeTransactions) {
      const categoryId = transaction.categoryId;
      const categoryName = transaction.category.name;
      const amount = Number(transaction.amount);

      if (incomeCategoryCounts.has(categoryId)) {
        const existing = incomeCategoryCounts.get(categoryId)!;
        existing.count += 1;
        existing.totalAmount += amount;
      } else {
        incomeCategoryCounts.set(categoryId, {
          name: categoryName,
          count: 1,
          totalAmount: amount,
        });
      }
    }

    // Convertir en tableau et trier par montant total (décroissant) pour classer par pourcentage
    topIncomeCategories = Array.from(incomeCategoryCounts.values())
      .sort((a, b) => b.totalAmount - a.totalAmount) // Trier par montant total (pas par nombre de transactions)
      .slice(0, 3) // Top 3 pour les revenus (premium uniquement)
      .map((cat) => {
        // Calculer le pourcentage par rapport au total des revenus
        const percentage = totalIncome > 0 ? (cat.totalAmount / totalIncome) * 100 : 0;
        return {
          name: cat.name,
          transactionCount: cat.count,
          totalAmount: cat.totalAmount,
          percentage: Math.round(percentage * 100) / 100, // Arrondir à 2 décimales
        };
      });
  }

  return {
    totals: {
      totalIncome,
      totalExpense,
      difference,
      transactionCount: transactions.length,
    },
    topExpenseCategories,
    ...(isPremium && { topIncomeCategories }), // Inclure seulement si premium
    userSince: user.createdAt,
  };
}

/**
 * Récupère uniquement les totaux depuis l'inscription
 * 
 * @param userId - ID de l'utilisateur
 * @returns Totaux (revenus, dépenses, différence)
 */
export async function getTotalsSinceRegistration(userId: string) {
  const stats = await getUserStats(userId);
  return stats.totals;
}

/**
 * Récupère le top des catégories de dépenses les plus utilisées
 * 
 * @param userId - ID de l'utilisateur
 * @returns Top catégories de dépenses (top 3 si premium, top 2 sinon)
 */
export async function getTopExpenseCategories(userId: string) {
  const stats = await getUserStats(userId);
  return stats.topExpenseCategories;
}

/**
 * Récupère les statistiques premium pour une période spécifique
 * 
 * @param userId - ID de l'utilisateur
 * @param startDate - Date de début (inclusive)
 * @param endDate - Date de fin (inclusive)
 * @returns Statistiques complètes pour la période spécifiée
 */
export async function getPremiumStats(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // Récupérer les transactions dans la période spécifiée
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
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
    orderBy: {
      date: "desc",
    },
  });

  // Calculer les totaux pour la période
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

  // Calculer le top 3 des catégories de dépenses les plus utilisées (premium uniquement)
  const expenseTransactions = transactions.filter(
    (t) => t.category.type === "EXPENSE"
  );

  // Compter les occurrences par catégorie de dépenses
  const expenseCategoryCounts = new Map<string, { name: string; count: number; totalAmount: number }>();

  for (const transaction of expenseTransactions) {
    const categoryId = transaction.categoryId;
    const categoryName = transaction.category.name;
    const amount = Number(transaction.amount);

    if (expenseCategoryCounts.has(categoryId)) {
      const existing = expenseCategoryCounts.get(categoryId)!;
      existing.count += 1;
      existing.totalAmount += amount;
    } else {
      expenseCategoryCounts.set(categoryId, {
        name: categoryName,
        count: 1,
        totalAmount: amount,
      });
    }
  }

  // Convertir en tableau et trier par montant total (décroissant) pour classer par pourcentage
  const topExpenseCategories = Array.from(expenseCategoryCounts.values())
    .sort((a, b) => b.totalAmount - a.totalAmount) // Trier par montant total (pas par nombre de transactions)
    .slice(0, 3) // Top 3 pour premium
    .map((cat) => {
      // Calculer le pourcentage par rapport au total des dépenses de la période
      const percentage = totalExpense > 0 ? (cat.totalAmount / totalExpense) * 100 : 0;
      return {
        name: cat.name,
        transactionCount: cat.count,
        totalAmount: cat.totalAmount,
        percentage: Math.round(percentage * 100) / 100, // Arrondir à 2 décimales
      };
    });

  // Calculer le top 3 des catégories de revenus les plus utilisées (premium uniquement)
  const incomeTransactions = transactions.filter(
    (t) => t.category.type === "INCOME"
  );

  // Compter les occurrences par catégorie de revenus
  const incomeCategoryCounts = new Map<string, { name: string; count: number; totalAmount: number }>();

  for (const transaction of incomeTransactions) {
    const categoryId = transaction.categoryId;
    const categoryName = transaction.category.name;
    const amount = Number(transaction.amount);

    if (incomeCategoryCounts.has(categoryId)) {
      const existing = incomeCategoryCounts.get(categoryId)!;
      existing.count += 1;
      existing.totalAmount += amount;
    } else {
      incomeCategoryCounts.set(categoryId, {
        name: categoryName,
        count: 1,
        totalAmount: amount,
      });
    }
  }

  // Convertir en tableau et trier par montant total (décroissant) pour classer par pourcentage
  const topIncomeCategories = Array.from(incomeCategoryCounts.values())
    .sort((a, b) => b.totalAmount - a.totalAmount) // Trier par montant total (pas par nombre de transactions)
    .slice(0, 3) // Top 3 pour les revenus
    .map((cat) => {
      // Calculer le pourcentage par rapport au total des revenus de la période
      const percentage = totalIncome > 0 ? (cat.totalAmount / totalIncome) * 100 : 0;
      return {
        name: cat.name,
        transactionCount: cat.count,
        totalAmount: cat.totalAmount,
        percentage: Math.round(percentage * 100) / 100, // Arrondir à 2 décimales
      };
    });

  return {
    totals: {
      totalIncome,
      totalExpense,
      difference,
      transactionCount: transactions.length,
    },
    topExpenseCategories,
    topIncomeCategories,
    period: {
      startDate,
      endDate,
    },
  };
}

