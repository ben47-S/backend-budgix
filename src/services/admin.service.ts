/**
 * Service Admin - Gestion des fonctionnalités administrateur
 * 
 * Ce service gère :
 * - La récupération de la liste des utilisateurs avec pagination
 * - La récupération des détails d'un utilisateur
 * - La mise à jour des utilisateurs (rôle, statut premium)
 * - La suppression d'utilisateurs
 * - Les statistiques globales de la plateforme
 * - La gestion des catégories globales
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { sendNotificationToUser } from "./notification.service";
import { getActivePushTokens } from "./pushToken.service";
import { emitToUser } from "./websocket.service";
import logger from "../lib/logger";
import { Prisma } from "../../generated/prisma/client";
import {
  createOrUpdateSubscription,
  cancelSubscription,
  getUserSubscription,
  isSubscriptionActive
} from "./subscription.service";

/**
 * Interface pour les paramètres de pagination
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Interface pour les filtres de recherche d'utilisateurs
 */
export interface UserFilters {
  search?: string; // Recherche par username, email ou phone
  isPremium?: boolean;
  role?: "USER" | "ADMIN";
  createdAtFrom?: Date;
  createdAtTo?: Date;
}

/**
 * Récupère la liste des utilisateurs avec pagination et filtres
 * 
 * @param filters - Filtres de recherche
 * @param pagination - Paramètres de pagination
 * @returns Liste paginée des utilisateurs
 */
export async function getUsers(filters: UserFilters = {}, pagination: PaginationParams = {}) {
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 20, 1000); // Maximum 1000 par page
  const skip = (page - 1) * limit;

  // Construire les conditions de filtrage Prisma
  const where: Prisma.UserWhereInput = {};

  // Filtre de recherche (username, email ou phone)
  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Filtre par statut premium
  if (filters.isPremium !== undefined) {
    where.isPremium = filters.isPremium;
  }

  // Filtre par rôle
  if (filters.role) {
    where.role = filters.role;
  }

  // Filtre par date de création
  if (filters.createdAtFrom || filters.createdAtTo) {
    where.createdAt = {};
    if (filters.createdAtFrom) {
      where.createdAt.gte = filters.createdAtFrom;
    }
    if (filters.createdAtTo) {
      where.createdAt.lte = filters.createdAtTo;
    }
  }

  // Récupérer les utilisateurs avec le nombre total
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        isPremium: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transactions: true,
            budgets: true,
            debts: true,
            externalSubscriptions: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Récupère les détails complets d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Détails de l'utilisateur avec statistiques
 */
export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      isPremium: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      subscription: {
        select: {
          id: true,
          plan: true,
          price: true,
          startDate: true,
          endDate: true,
        },
      },
      _count: {
        select: {
          transactions: true,
          budgets: true,
          debts: true,
          externalSubscriptions: true,
          categories: true,
          notifications: true,
        },
      },
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // Calculer les statistiques financières de l'utilisateur
  const transactionStats = await prisma.transaction.aggregate({
    where: { userId },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  const expenseStats = await prisma.transaction.aggregate({
    where: {
      userId,
      category: {
        type: "EXPENSE",
      },
    },
    _sum: {
      amount: true,
    },
  });

  const incomeStats = await prisma.transaction.aggregate({
    where: {
      userId,
      category: {
        type: "INCOME",
      },
    },
    _sum: {
      amount: true,
    },
  });

  return {
    ...user,
    stats: {
      totalTransactions: transactionStats._count.id,
      totalAmount: transactionStats._sum.amount || 0,
      totalExpenses: expenseStats._sum.amount || 0,
      totalIncome: incomeStats._sum.amount || 0,
    },
  };
}

/**
 * Met à jour un utilisateur (rôle, statut premium, etc.)
 * 
 * @param userId - ID de l'utilisateur
 * @param data - Données à mettre à jour
 * @returns Utilisateur mis à jour
 */
export async function updateUser(
  userId: string,
  data: {
    role?: "USER" | "ADMIN";
    isPremium?: boolean;
    username?: string;
  }
) {
  // Vérifier que l'utilisateur existe
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // NOUVELLE LOGIQUE: Gérer automatiquement les abonnements
  if (data.isPremium !== undefined && data.isPremium !== existingUser.isPremium) {
    if (data.isPremium === true) {
      // Admin active le premium → créer un abonnement MONTHLY par défaut
      logger.info("Admin activation du premium - Création automatique d'abonnement MONTHLY", {
        userId,
        adminAction: true
      });

      // Créer ou mettre à jour l'abonnement avec plan MONTHLY
      await createOrUpdateSubscription(userId, "MONTHLY");

      // Note: createOrUpdateSubscription() met déjà isPremium=true
      // donc on peut retirer isPremium de data pour éviter double update
      delete data.isPremium;

    } else if (data.isPremium === false) {
      // Admin désactive le premium → annuler l'abonnement si existant
      logger.info("Admin désactivation du premium - Annulation de l'abonnement", {
        userId,
        adminAction: true
      });

      const existingSubscription = await getUserSubscription(userId);
      if (existingSubscription && isSubscriptionActive(existingSubscription)) {
        // Annuler l'abonnement (met endDate à maintenant)
        await cancelSubscription(userId);
        // cancelSubscription() met déjà isPremium=false
        delete data.isPremium;
      }
    }
  }

  // Mettre à jour l'utilisateur avec les données restantes (si applicable)
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      isPremium: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      subscription: {
        select: {
          id: true,
          plan: true,
          price: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  // Émettre un événement WebSocket pour notifier l'utilisateur de la mise à jour de son profil
  // Cela permet une mise à jour en temps réel sans rechargement de l'app
  try {
    emitToUser(userId, 'profile-updated', {
      user: updatedUser,
      message: 'Votre profil a été mis à jour par un administrateur',
    });

    logger.info("Événement profile-updated émis via WebSocket", {
      userId,
      isPremium: updatedUser.isPremium,
      role: updatedUser.role,
    });
  } catch (error) {
    // Ne pas bloquer la mise à jour si l'émission WebSocket échoue
    logger.warn("Impossible d'émettre l'événement WebSocket profile-updated", {
      userId,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }

  return updatedUser;
}

/**
 * Supprime un utilisateur et toutes ses données associées
 * 
 * @param userId - ID de l'utilisateur
 */
export async function deleteUser(userId: string) {
  // Vérifier que l'utilisateur existe
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // Bloquer la suppression des administrateurs
  if (existingUser.role === "ADMIN") {
    throw createError(
      "Impossible de supprimer un administrateur",
      403,
      "ADMIN_DELETE_FORBIDDEN"
    );
  }

  // Supprimer l'utilisateur (cascade supprimera toutes les données associées)
  await prisma.user.delete({
    where: { id: userId },
  });

  return { success: true };
}

/**
 * Récupère les statistiques globales de la plateforme
 * 
 * @returns Statistiques globales
 */
export async function getGlobalStats() {
  // Compter les utilisateurs
  const [
    totalUsers,
    premiumUsers,
    adminUsers,
    totalTransactions,
    totalBudgets,
    totalDebts,
    totalExternalSubscriptions,
    totalCategories,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.transaction.count(),
    prisma.budget.count(),
    prisma.debt.count(),
    prisma.externalSubscription.count(),
    prisma.category.count({ where: { userId: null } }), // Catégories globales uniquement
  ]);

  // Calculer les statistiques financières globales
  const transactionStats = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
  });

  const expenseStats = await prisma.transaction.aggregate({
    where: {
      category: {
        type: "EXPENSE",
      },
    },
    _sum: {
      amount: true,
    },
  });

  const incomeStats = await prisma.transaction.aggregate({
    where: {
      category: {
        type: "INCOME",
      },
    },
    _sum: {
      amount: true,
    },
  });

  // Statistiques d'abonnements premium
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      endDate: null, // Abonnements actifs
    },
  });

  // Statistiques des nouveaux utilisateurs (30 derniers jours)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newUsersLast30Days = await prisma.user.count({
    where: {
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  return {
    users: {
      total: totalUsers,
      premium: premiumUsers,
      admin: adminUsers,
      regular: totalUsers - premiumUsers - adminUsers,
      newLast30Days: newUsersLast30Days,
    },
    transactions: {
      total: totalTransactions,
      totalAmount: transactionStats._sum.amount || 0,
      totalExpenses: expenseStats._sum.amount || 0,
      totalIncome: incomeStats._sum.amount || 0,
    },
    features: {
      budgets: totalBudgets,
      debts: totalDebts,
      externalSubscriptions: totalExternalSubscriptions,
      globalCategories: totalCategories,
    },
    subscriptions: {
      active: activeSubscriptions,
    },
  };
}

/**
 * Récupère les catégories globales (créées par les admins)
 * 
 * @returns Liste des catégories globales
 */
export async function getGlobalCategories() {
  const categories = await prisma.category.findMany({
    where: {
      userId: null, // Catégories globales uniquement
    },
    orderBy: [
      { type: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          transactions: true,
          budgets: true,
        },
      },
    },
  });

  return categories;
}

/**
 * Crée une nouvelle catégorie globale
 * 
 * @param name - Nom de la catégorie
 * @param type - Type de catégorie (INCOME ou EXPENSE)
 * @returns Catégorie créée
 */
export async function createGlobalCategory(name: string, type: "INCOME" | "EXPENSE") {
  // Vérifier si la catégorie existe déjà (globale)
  const existingCategory = await prisma.category.findFirst({
    where: {
      name,
      type,
      userId: null,
    },
  });

  if (existingCategory) {
    throw createError(
      "Une catégorie globale avec ce nom et ce type existe déjà",
      409,
      "CATEGORY_EXISTS"
    );
  }

  // Créer la catégorie globale
  const category = await prisma.category.create({
    data: {
      name,
      type,
      userId: null, // Catégorie globale
    },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return category;
}

/**
 * Met à jour une catégorie globale
 * 
 * @param categoryId - ID de la catégorie
 * @param data - Données à mettre à jour
 * @returns Catégorie mise à jour
 */
export async function updateGlobalCategory(
  categoryId: string,
  data: {
    name?: string;
    type?: "INCOME" | "EXPENSE";
  }
) {
  // Vérifier que la catégorie existe et est globale
  const existingCategory = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!existingCategory) {
    throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
  }

  if (existingCategory.userId !== null) {
    throw createError(
      "Cette catégorie n'est pas une catégorie globale",
      403,
      "NOT_GLOBAL_CATEGORY"
    );
  }

  // Vérifier les conflits si le nom ou le type change
  if (data.name || data.type) {
    const newName = data.name || existingCategory.name;
    const newType = data.type || existingCategory.type;

    const conflictingCategory = await prisma.category.findFirst({
      where: {
        name: newName,
        type: newType,
        userId: null,
        id: { not: categoryId },
      },
    });

    if (conflictingCategory) {
      throw createError(
        "Une catégorie globale avec ce nom et ce type existe déjà",
        409,
        "CATEGORY_EXISTS"
      );
    }
  }

  // Mettre à jour la catégorie
  const updatedCategory = await prisma.category.update({
    where: { id: categoryId },
    data,
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedCategory;
}

/**
 * Supprime une catégorie globale
 * 
 * @param categoryId - ID de la catégorie
 */
export async function deleteGlobalCategory(categoryId: string) {
  // Vérifier que la catégorie existe et est globale
  const existingCategory = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!existingCategory) {
    throw createError("Catégorie non trouvée", 404, "CATEGORY_NOT_FOUND");
  }

  if (existingCategory.userId !== null) {
    throw createError(
      "Cette catégorie n'est pas une catégorie globale",
      403,
      "NOT_GLOBAL_CATEGORY"
    );
  }

  // Supprimer la catégorie (cascade supprimera les transactions associées)
  await prisma.category.delete({
    where: { id: categoryId },
  });

  return { success: true };
}

/**
 * Récupère tous les abonnements externes de tous les utilisateurs (Admin)
 *
 * @param filters - Filtres de recherche
 * @param pagination - Paramètres de pagination
 * @returns Liste paginée des abonnements externes
 */
export async function getAllExternalSubscriptions(
  filters: {
    search?: string; // Recherche par nom d'abonnement ou username
    isActive?: boolean;
    billingCycle?: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";
    minAmount?: number;
    maxAmount?: number;
  } = {},
  pagination: PaginationParams = {}
) {
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 20, 1000);
  const skip = (page - 1) * limit;

  // Construire les conditions de filtrage
  const where: Prisma.ExternalSubscriptionWhereInput = {};

  // Filtre de recherche (nom d'abonnement ou username)
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { user: { username: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  // Filtre par statut actif
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Filtre par cycle de facturation
  if (filters.billingCycle) {
    where.billingCycle = filters.billingCycle;
  }

  // Filtre par montant
  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) {
      where.amount.gte = filters.minAmount;
    }
    if (filters.maxAmount !== undefined) {
      where.amount.lte = filters.maxAmount;
    }
  }

  // Récupérer les abonnements avec le nombre total
  const [subscriptions, total] = await Promise.all([
    prisma.externalSubscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { nextBillingDate: "asc" }, // Prochaines échéances en premier
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
            isPremium: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    }),
    prisma.externalSubscription.count({ where }),
  ]);

  // Ajouter le statut d'expiration pour chaque abonnement
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const subscriptionsWithStatus = subscriptions.map((sub) => {
    const nextBillingDateOnly = new Date(
      sub.nextBillingDate.getFullYear(),
      sub.nextBillingDate.getMonth(),
      sub.nextBillingDate.getDate()
    );

    const isExpired = nextBillingDateOnly <= today;

    return {
      ...sub,
      expirationStatus: isExpired ? "échéance atteinte" : null,
    };
  });

  return {
    subscriptions: subscriptionsWithStatus,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Envoie une notification push à un utilisateur depuis l'admin
 *
 * Cette fonction permet aux administrateurs d'envoyer des notifications push
 * directement à un utilisateur spécifique, en contournant les préférences de notification
 * (pour les notifications importantes de l'admin).
 *
 * @param userId - ID de l'utilisateur destinataire
 * @param title - Titre de la notification
 * @param body - Corps de la notification
 * @param data - Données supplémentaires (optionnel)
 * @returns Résultat de l'envoi avec informations sur les tokens utilisés
 */
export async function sendNotificationToUserFromAdmin(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });

  if (!user) {
    throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
  }

  // Récupérer les tokens push actifs de l'utilisateur
  const tokens = await getActivePushTokens(userId);

  if (tokens.length === 0) {
    logger.warn("Aucun token push actif trouvé pour l'utilisateur", {
      userId,
      username: user.username,
      email: user.email,
    });
    
    return {
      success: false,
      message: "Aucun token push actif trouvé pour cet utilisateur",
      tokensCount: 0,
      tokens: [],
    };
  }

  // Envoyer la notification en contournant les préférences (admin peut forcer l'envoi)
  // On utilise requireBudgetAlerts=false, requireReminders=false, requireSubscriptionReminders=false
  // pour envoyer à tous les tokens actifs, peu importe les préférences
  try {
    await sendNotificationToUser(
      userId,
      title,
      body,
      {
        ...data,
        adminNotification: true, // Marquer comme notification admin
      },
      false, // requireBudgetAlerts = false
      false, // requireReminders = false
      false  // requireSubscriptionReminders = false
    );

    logger.info("Notification admin envoyée avec succès", {
      userId,
      username: user.username,
      email: user.email,
      title,
      tokensCount: tokens.length,
    });

    return {
      success: true,
      message: "Notification envoyée avec succès",
      tokensCount: tokens.length,
      tokens: tokens.map(t => ({
        id: t.id,
        platform: t.platform,
        deviceId: t.deviceId,
      })),
    };
  } catch (error) {
    logger.error("Erreur lors de l'envoi de la notification admin", {
      userId,
      username: user.username,
      email: user.email,
      title,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
    
    throw createError(
      `Erreur lors de l'envoi de la notification: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      500,
      "NOTIFICATION_SEND_ERROR"
    );
  }
}

