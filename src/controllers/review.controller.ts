/**
 * Contrôleur pour la gestion des avis utilisateurs
 * 
 * Ce contrôleur gère les requêtes HTTP pour :
 * - Créer un avis (note avec étoiles, commentaire optionnel)
 * - Récupérer l'avis de l'utilisateur authentifié
 * - Récupérer tous les avis (admin uniquement)
 * - Mettre à jour un avis existant
 * - Supprimer un avis
 * - Récupérer les statistiques des avis (admin uniquement)
 * 
 * Note : Les suggestions d'amélioration sont gérées séparément dans improvement-suggestion.controller.ts
 */

import type { Request, Response, NextFunction } from "express";
import {
  createReview,
  getUserReview,
  getAllReviews,
  updateReview,
  deleteReview,
  getReviewStats,
} from "../services/review.service";
import { createError } from "../middleware/errorHandler";
import logger from "../lib/logger";

/**
 * Crée un nouvel avis pour l'utilisateur authentifié
 */
export async function createReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const { rating, comment } = req.body;

    // Vérifier que la note est fournie
    if (!rating || typeof rating !== "number") {
      return next(createError("La note est requise et doit être un nombre", 400, "INVALID_INPUT"));
    }

    const review = await createReview(userId, {
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      message: "Avis créé avec succès",
      data: review,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la création de l'avis: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère l'avis de l'utilisateur authentifié
 */
export async function getUserReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const review = await getUserReview(userId);

    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de l'avis: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère tous les avis (admin uniquement)
 */
export async function getAllReviewsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviews = await getAllReviews();

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de tous les avis: ${error.message}`);
    next(error);
  }
}

/**
 * Met à jour l'avis de l'utilisateur authentifié
 */
export async function updateReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const { rating, comment } = req.body;

    // Vérifier qu'au moins un champ est fourni
    if (rating === undefined && comment === undefined) {
      return next(createError("Au moins un champ doit être fourni pour la mise à jour", 400, "INVALID_INPUT"));
    }

    const review = await updateReview(userId, {
      rating,
      comment,
    });

    res.json({
      success: true,
      message: "Avis mis à jour avec succès",
      data: review,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la mise à jour de l'avis: ${error.message}`);
    next(error);
  }
}

/**
 * Supprime l'avis de l'utilisateur authentifié
 */
export async function deleteReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    await deleteReview(userId);

    res.json({
      success: true,
      message: "Avis supprimé avec succès",
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la suppression de l'avis: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère les statistiques des avis (admin uniquement)
 */
export async function getReviewStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getReviewStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des statistiques des avis: ${error.message}`);
    next(error);
  }
}

