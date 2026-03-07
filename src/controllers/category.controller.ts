/**
 * Contrôleur de gestion des catégories
 * 
 * Gère les requêtes HTTP liées aux catégories :
 * - Liste des catégories (globales + personnalisées)
 * - Création de catégories personnalisées
 */

import type { Request, Response, NextFunction } from "express";
import { getCategories, createCategory } from "../services/category.service.js";
import { createError } from "../middleware/errorHandler.js";
import type { CategoryType } from "../generated/prisma/client.js";

/**
 * Récupère toutes les catégories disponibles pour l'utilisateur connecté
 * 
 * GET /api/categories
 * Query params: ?type=INCOME|EXPENSE (optionnel)
 */
export async function getCategoriesController(
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

    // Récupérer le type depuis les query params (optionnel)
    const type = req.query.type as CategoryType | undefined;

    // Valider le type si fourni
    if (type && type !== "INCOME" && type !== "EXPENSE") {
      throw createError(
        "Type de catégorie invalide. Valeurs acceptées : INCOME, EXPENSE",
        400,
        "INVALID_TYPE"
      );
    }

    const categories = await getCategories(userId, type);

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crée une nouvelle catégorie personnalisée
 * 
 * POST /api/categories
 * Body: { name: string, type: "INCOME" | "EXPENSE" }
 */
export async function createCategoryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // TODO: Récupérer userId depuis le token/session une fois l'auth implémentée
    const userId = req.userId || "test-user-id"; // À remplacer par req.userId une fois l'auth en place

    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { name, type } = req.body;

    // Valider les données d'entrée
    if (!name || typeof name !== "string") {
      throw createError("Le nom de la catégorie est requis", 400, "NAME_REQUIRED");
    }

    if (!type || (type !== "INCOME" && type !== "EXPENSE")) {
      throw createError(
        "Le type de catégorie est requis et doit être INCOME ou EXPENSE",
        400,
        "TYPE_REQUIRED"
      );
    }

    const category = await createCategory(userId, name, type);

    res.status(201).json({
      success: true,
      message: "Catégorie créée avec succès",
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

