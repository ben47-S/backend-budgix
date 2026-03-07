/**
 * Contrôleur pour la gestion des suggestions d'amélioration
 * 
 * Ce contrôleur gère les requêtes HTTP pour :
 * - Créer une suggestion d'amélioration (plusieurs par utilisateur)
 * - Récupérer les suggestions de l'utilisateur authentifié
 * - Récupérer toutes les suggestions (admin uniquement)
 * - Récupérer une suggestion par son ID
 * - Mettre à jour une suggestion existante
 * - Supprimer une suggestion
 * - Récupérer les statistiques des suggestions (admin uniquement)
 */

import type { Request, Response, NextFunction } from "express";
import {
  createImprovementSuggestion,
  getUserImprovementSuggestions,
  getAllImprovementSuggestions,
  getImprovementSuggestionById,
  updateImprovementSuggestion,
  deleteImprovementSuggestion,
  getImprovementSuggestionStats,
} from "../services/improvement-suggestion.service.js";
import { createError } from "../middleware/errorHandler.js";
import logger from "../lib/logger.js";

/**
 * Crée une nouvelle suggestion d'amélioration pour l'utilisateur authentifié
 */
export async function createImprovementSuggestionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const { content } = req.body;

    // Vérifier que le contenu est fourni
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return next(createError("Le contenu de la suggestion est requis", 400, "INVALID_INPUT"));
    }

    const suggestion = await createImprovementSuggestion(userId, { content });

    res.status(201).json({
      success: true,
      message: "Suggestion d'amélioration créée avec succès",
      data: suggestion,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la création de la suggestion: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère toutes les suggestions de l'utilisateur authentifié
 */
export async function getUserImprovementSuggestionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const suggestions = await getUserImprovementSuggestions(userId);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des suggestions: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère toutes les suggestions (admin uniquement)
 */
export async function getAllImprovementSuggestionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const suggestions = await getAllImprovementSuggestions();

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de toutes les suggestions: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère une suggestion par son ID
 */
export async function getImprovementSuggestionByIdController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { suggestionId } = req.params;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!suggestionId || typeof suggestionId !== "string") {
      return next(createError("ID de suggestion invalide", 400, "INVALID_INPUT"));
    }

    const suggestion = await getImprovementSuggestionById(suggestionId, userId, isAdmin);

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de la suggestion: ${error.message}`);
    next(error);
  }
}

/**
 * Met à jour une suggestion existante
 */
export async function updateImprovementSuggestionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { suggestionId } = req.params;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!suggestionId || typeof suggestionId !== "string") {
      return next(createError("ID de suggestion invalide", 400, "INVALID_INPUT"));
    }

    const { content } = req.body;

    // Vérifier qu'au moins un champ est fourni
    if (content === undefined) {
      return next(createError("Le contenu de la suggestion est requis", 400, "INVALID_INPUT"));
    }

    const suggestion = await updateImprovementSuggestion(suggestionId, userId, { content }, isAdmin);

    res.json({
      success: true,
      message: "Suggestion mise à jour avec succès",
      data: suggestion,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la mise à jour de la suggestion: ${error.message}`);
    next(error);
  }
}

/**
 * Supprime une suggestion
 */
export async function deleteImprovementSuggestionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { suggestionId } = req.params;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!suggestionId || typeof suggestionId !== "string") {
      return next(createError("ID de suggestion invalide", 400, "INVALID_INPUT"));
    }

    await deleteImprovementSuggestion(suggestionId, userId, isAdmin);

    res.json({
      success: true,
      message: "Suggestion supprimée avec succès",
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la suppression de la suggestion: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère les statistiques des suggestions (admin uniquement)
 */
export async function getImprovementSuggestionStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getImprovementSuggestionStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des statistiques des suggestions: ${error.message}`);
    next(error);
  }
}

