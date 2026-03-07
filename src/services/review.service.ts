/**
 * Service de gestion des avis utilisateurs
 * 
 * Ce service gère :
 * - La création d'avis (note avec étoiles, commentaire optionnel)
 * - La récupération des avis d'un utilisateur
 * - La récupération de tous les avis (pour les admins)
 * - La mise à jour d'un avis existant
 * - La suppression d'un avis
 * 
 * Note : Les suggestions d'amélioration sont gérées séparément dans improvement-suggestion.service.ts
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import logger from "../lib/logger.js";

/**
 * Interface pour créer un avis
 */
export interface CreateReviewData {
  rating: number; // Note de 1 à 5 étoiles
  comment?: string; // Commentaire optionnel
}

/**
 * Crée un nouvel avis pour l'utilisateur authentifié
 * Un utilisateur ne peut avoir qu'un seul avis
 */
export async function createReview(userId: string, data: CreateReviewData) {
  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
    }

    // Vérifier que la note est valide (entre 1 et 5)
    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw createError("La note doit être un entier entre 1 et 5", 400, "INVALID_INPUT");
    }

    // Vérifier si l'utilisateur a déjà un avis
    const existingReview = await prisma.review.findUnique({
      where: { userId },
    });

    if (existingReview) {
      throw createError("Vous avez déjà soumis un avis. Vous pouvez le modifier ou le supprimer.", 400, "REVIEW_ALREADY_EXISTS");
    }

    // Valider la longueur du commentaire si fourni
    if (data.comment && data.comment.length > 2000) {
      throw createError("Le commentaire ne peut pas dépasser 2000 caractères", 400, "INVALID_INPUT");
    }

    // Créer l'avis
    const review = await prisma.review.create({
      data: {
        userId,
        rating: data.rating,
        comment: data.comment?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Avis créé: ${review.id} pour l'utilisateur ${userId} avec une note de ${data.rating}`);
    return review;
  } catch (error: any) {
    logger.error(`Erreur lors de la création de l'avis: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère l'avis d'un utilisateur
 */
export async function getUserReview(userId: string) {
  try {
    const review = await prisma.review.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return review;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de l'avis: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère tous les avis (pour les admins)
 */
export async function getAllReviews() {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return reviews;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de tous les avis: ${error.message}`);
    throw error;
  }
}

/**
 * Met à jour un avis existant
 */
export async function updateReview(userId: string, data: Partial<CreateReviewData>) {
  try {
    // Vérifier que l'avis existe
    const existingReview = await prisma.review.findUnique({
      where: { userId },
    });

    if (!existingReview) {
      throw createError("Avis non trouvé", 404, "REVIEW_NOT_FOUND");
    }

    // Valider la note si fournie
    if (data.rating !== undefined) {
      if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
        throw createError("La note doit être un entier entre 1 et 5", 400, "INVALID_INPUT");
      }
    }

    // Valider la longueur du commentaire si fourni
    if (data.comment !== undefined && data.comment.length > 2000) {
      throw createError("Le commentaire ne peut pas dépasser 2000 caractères", 400, "INVALID_INPUT");
    }

    // Construire l'objet de mise à jour avec seulement les champs fournis
    const updateData: {
      rating?: number;
      comment?: string | null;
    } = {};

    if (data.rating !== undefined) {
      updateData.rating = data.rating;
    }

    if (data.comment !== undefined) {
      updateData.comment = data.comment.trim() || null;
    }

    // Mettre à jour l'avis
    const review = await prisma.review.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Avis mis à jour: ${review.id} pour l'utilisateur ${userId}`);
    return review;
  } catch (error: any) {
    logger.error(`Erreur lors de la mise à jour de l'avis: ${error.message}`);
    throw error;
  }
}

/**
 * Supprime un avis
 */
export async function deleteReview(userId: string) {
  try {
    // Vérifier que l'avis existe
    const existingReview = await prisma.review.findUnique({
      where: { userId },
    });

    if (!existingReview) {
      throw createError("Avis non trouvé", 404, "REVIEW_NOT_FOUND");
    }

    // Supprimer l'avis
    await prisma.review.delete({
      where: { userId },
    });

    logger.info(`Avis supprimé pour l'utilisateur ${userId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`Erreur lors de la suppression de l'avis: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère les statistiques des avis (pour les admins)
 */
export async function getReviewStats() {
  try {
    const reviews = await prisma.review.findMany({
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    }

    // Calculer la moyenne
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Calculer la distribution des notes
    const ratingDistribution = {
      1: reviews.filter((r) => r.rating === 1).length,
      2: reviews.filter((r) => r.rating === 2).length,
      3: reviews.filter((r) => r.rating === 3).length,
      4: reviews.filter((r) => r.rating === 4).length,
      5: reviews.filter((r) => r.rating === 5).length,
    };

    return {
      totalReviews: reviews.length,
      averageRating: Math.round(averageRating * 10) / 10, // Arrondir à 1 décimale
      ratingDistribution,
    };
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des statistiques des avis: ${error.message}`);
    throw error;
  }
}

