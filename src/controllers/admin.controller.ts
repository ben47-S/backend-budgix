/**
 * Contrôleur Admin - Gestion des fonctionnalités administrateur
 * 
 * Ce contrôleur gère toutes les routes admin :
 * - Gestion des utilisateurs (liste, détails, mise à jour, suppression)
 * - Statistiques globales
 * - Gestion des catégories globales
 */

import type { Request, Response, NextFunction } from "express";
import {
  getUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  getGlobalStats,
  getGlobalCategories,
  createGlobalCategory,
  updateGlobalCategory,
  deleteGlobalCategory,
  sendNotificationToUserFromAdmin,
  getAllExternalSubscriptions,
  type UserFilters,
  type PaginationParams,
} from "../services/admin.service";
import { formatDatesInObject } from "../utils/date-formatter";

/**
 * Récupère la liste des utilisateurs avec pagination et filtres
 * 
 * GET /api/admin/users
 * Query params: page, limit, search, isPremium, role, createdAtFrom, createdAtTo
 */
export async function getUsersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Log pour déboguer (en développement)
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin] Query params reçus:", req.query);
    }

    // Extraire les paramètres de pagination
    const pagination: PaginationParams = {};
    if (req.query.page) {
      pagination.page = parseInt(req.query.page as string, 10);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string, 10);
    }

    // Extraire les filtres
    const filters: UserFilters = {};
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.isPremium === "true" || req.query.isPremium === "false") {
      filters.isPremium = req.query.isPremium === "true";
    }
    // Vérifier le rôle - peut venir de req.query directement ou de la validation Zod
    const roleParam = req.query.role;
    if (roleParam) {
      const roleStr = String(roleParam).toUpperCase();
      if (roleStr === "USER" || roleStr === "ADMIN") {
        filters.role = roleStr as "USER" | "ADMIN";
      }
    }

    // Log pour déboguer (en développement)
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin] Filtres appliqués:", filters);
      console.log("[Admin] Pagination:", pagination);
    }
    if (req.query.createdAtFrom) {
      filters.createdAtFrom = new Date(req.query.createdAtFrom as string);
    }
    if (req.query.createdAtTo) {
      filters.createdAtTo = new Date(req.query.createdAtTo as string);
    }

    const result = await getUsers(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les détails complets d'un utilisateur
 * 
 * GET /api/admin/users/:userId
 */
export async function getUserDetailsController(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;

    const userDetails = await getUserDetails(userId);

    res.json({
      success: true,
      data: {
        user: userDetails,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour un utilisateur
 * 
 * PUT /api/admin/users/:userId
 * Body: { role?, isPremium?, username? }
 */
export async function updateUserController(
  req: Request<{ userId: string }, {}, { role?: "USER" | "ADMIN"; isPremium?: boolean; username?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;
    const { role, isPremium, username } = req.body;

    const updateData: { role?: "USER" | "ADMIN"; isPremium?: boolean; username?: string } = {};
    if (role !== undefined) {
      updateData.role = role;
    }
    if (isPremium !== undefined) {
      updateData.isPremium = isPremium;
    }
    if (username !== undefined) {
      updateData.username = username;
    }

    const updatedUser = await updateUser(userId, updateData);

    res.json({
      success: true,
      message: "Utilisateur mis à jour avec succès",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un utilisateur
 * 
 * DELETE /api/admin/users/:userId
 */
export async function deleteUserController(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;

    await deleteUser(userId);

    res.json({
      success: true,
      message: "Utilisateur supprimé avec succès",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques globales de la plateforme
 * 
 * GET /api/admin/stats
 */
export async function getGlobalStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getGlobalStats();

    res.json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère la liste des catégories globales
 * 
 * GET /api/admin/categories
 */
export async function getGlobalCategoriesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const categories = await getGlobalCategories();

    res.json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crée une nouvelle catégorie globale
 * 
 * POST /api/admin/categories
 * Body: { name: string, type: "INCOME" | "EXPENSE" }
 */
export async function createGlobalCategoryController(
  req: Request<{}, {}, { name: string; type: "INCOME" | "EXPENSE" }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, type } = req.body;

    const category = await createGlobalCategory(name, type);

    res.status(201).json({
      success: true,
      message: "Catégorie globale créée avec succès",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour une catégorie globale
 * 
 * PUT /api/admin/categories/:categoryId
 * Body: { name?, type? }
 */
export async function updateGlobalCategoryController(
  req: Request<{ categoryId: string }, {}, { name?: string; type?: "INCOME" | "EXPENSE" }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { categoryId } = req.params;
    const { name, type } = req.body;

    const updateData: { name?: string; type?: "INCOME" | "EXPENSE" } = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (type !== undefined) {
      updateData.type = type;
    }

    const updatedCategory = await updateGlobalCategory(categoryId, updateData);

    res.json({
      success: true,
      message: "Catégorie globale mise à jour avec succès",
      data: {
        category: updatedCategory,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une catégorie globale
 * 
 * DELETE /api/admin/categories/:categoryId
 */
export async function deleteGlobalCategoryController(
  req: Request<{ categoryId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { categoryId } = req.params;

    await deleteGlobalCategory(categoryId);

    res.json({
      success: true,
      message: "Catégorie globale supprimée avec succès",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Envoie une notification push à un utilisateur depuis l'admin
 *
 * POST /api/admin/users/:userId/send-notification
 * Body: { title: string, body: string, data?: object }
 */
export async function sendNotificationToUserController(
  req: Request<{ userId: string }, {}, { title: string; body: string; data?: Record<string, any> }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;
    const { title, body, data } = req.body;

    const result = await sendNotificationToUserFromAdmin(userId, title, body, data);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        tokensCount: result.tokensCount,
        tokens: result.tokens,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère tous les abonnements externes de tous les utilisateurs (Admin)
 *
 * GET /api/admin/external-subscriptions
 * Query params: page, limit, search, isActive, billingCycle, minAmount, maxAmount
 */
export async function getAllExternalSubscriptionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extraire les paramètres de pagination
    const pagination: PaginationParams = {};
    if (req.query.page) {
      pagination.page = parseInt(req.query.page as string, 10);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string, 10);
    }

    // Extraire les filtres
    const filters: {
      search?: string;
      isActive?: boolean;
      billingCycle?: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";
      minAmount?: number;
      maxAmount?: number;
    } = {};

    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === "true";
    }
    if (req.query.billingCycle) {
      filters.billingCycle = req.query.billingCycle as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";
    }
    if (req.query.minAmount) {
      filters.minAmount = parseInt(req.query.minAmount as string, 10);
    }
    if (req.query.maxAmount) {
      filters.maxAmount = parseInt(req.query.maxAmount as string, 10);
    }

    const result = await getAllExternalSubscriptions(filters, pagination);

    res.json(formatDatesInObject({
      success: true,
      message: "Abonnements externes récupérés avec succès",
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}

