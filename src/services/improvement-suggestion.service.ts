/**
 * Service de gestion des suggestions d'amélioration
 * 
 * Ce service gère :
 * - La création de suggestions d'amélioration (plusieurs par utilisateur)
 * - La récupération des suggestions d'un utilisateur
 * - La récupération de toutes les suggestions (pour les admins)
 * - La mise à jour d'une suggestion existante
 * - La suppression d'une suggestion
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import logger from "../lib/logger";

/**
 * Interface pour créer une suggestion d'amélioration
 */
export interface CreateImprovementSuggestionData {
  content: string; // Contenu de la suggestion
}

/**
 * Crée une nouvelle suggestion d'amélioration pour l'utilisateur authentifié
 * Un utilisateur peut avoir plusieurs suggestions
 */
export async function createImprovementSuggestion(userId: string, data: CreateImprovementSuggestionData) {
  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
    }

    // Valider que le contenu est fourni
    if (!data.content || typeof data.content !== "string" || data.content.trim().length === 0) {
      throw createError("Le contenu de la suggestion est requis", 400, "INVALID_INPUT");
    }

    // Valider la longueur du contenu
    if (data.content.length > 2000) {
      throw createError("La suggestion ne peut pas dépasser 2000 caractères", 400, "INVALID_INPUT");
    }

    // Créer la suggestion
    const suggestion = await prisma.improvementSuggestion.create({
      data: {
        userId,
        content: data.content.trim(),
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

    logger.info(`Suggestion d'amélioration créée: ${suggestion.id} pour l'utilisateur ${userId}`);
    return suggestion;
  } catch (error: any) {
    logger.error(`Erreur lors de la création de la suggestion: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère toutes les suggestions d'un utilisateur
 */
export async function getUserImprovementSuggestions(userId: string) {
  try {
    const suggestions = await prisma.improvementSuggestion.findMany({
      where: { userId },
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

    return suggestions;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des suggestions: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère toutes les suggestions (pour les admins)
 */
export async function getAllImprovementSuggestions() {
  try {
    const suggestions = await prisma.improvementSuggestion.findMany({
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

    return suggestions;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de toutes les suggestions: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère une suggestion par son ID
 */
export async function getImprovementSuggestionById(suggestionId: string, userId?: string, isAdmin: boolean = false) {
  try {
    const suggestion = await prisma.improvementSuggestion.findUnique({
      where: { id: suggestionId },
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

    if (!suggestion) {
      throw createError("Suggestion non trouvée", 404, "SUGGESTION_NOT_FOUND");
    }

    // Vérifier les permissions : l'utilisateur doit être le propriétaire ou un admin
    if (!isAdmin && suggestion.userId !== userId) {
      throw createError("Accès refusé à cette suggestion", 403, "FORBIDDEN");
    }

    return suggestion;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de la suggestion: ${error.message}`);
    throw error;
  }
}

/**
 * Met à jour une suggestion existante
 */
export async function updateImprovementSuggestion(suggestionId: string, userId: string, data: Partial<CreateImprovementSuggestionData>, isAdmin: boolean = false) {
  try {
    // Vérifier que la suggestion existe
    const existingSuggestion = await prisma.improvementSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!existingSuggestion) {
      throw createError("Suggestion non trouvée", 404, "SUGGESTION_NOT_FOUND");
    }

    // Vérifier les permissions : seul le propriétaire ou un admin peut modifier
    if (!isAdmin && existingSuggestion.userId !== userId) {
      throw createError("Accès refusé", 403, "FORBIDDEN");
    }

    // Valider le contenu si fourni
    if (data.content !== undefined) {
      if (!data.content || typeof data.content !== "string" || data.content.trim().length === 0) {
        throw createError("Le contenu de la suggestion est requis", 400, "INVALID_INPUT");
      }

      if (data.content.length > 2000) {
        throw createError("La suggestion ne peut pas dépasser 2000 caractères", 400, "INVALID_INPUT");
      }
    }

    // Construire l'objet de mise à jour avec seulement les champs fournis
    const updateData: {
      content?: string;
    } = {};

    if (data.content !== undefined) {
      updateData.content = data.content.trim();
    }

    // Mettre à jour la suggestion
    const suggestion = await prisma.improvementSuggestion.update({
      where: { id: suggestionId },
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

    logger.info(`Suggestion mise à jour: ${suggestion.id} pour l'utilisateur ${userId}`);
    return suggestion;
  } catch (error: any) {
    logger.error(`Erreur lors de la mise à jour de la suggestion: ${error.message}`);
    throw error;
  }
}

/**
 * Supprime une suggestion
 */
export async function deleteImprovementSuggestion(suggestionId: string, userId: string, isAdmin: boolean = false) {
  try {
    // Vérifier que la suggestion existe
    const existingSuggestion = await prisma.improvementSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!existingSuggestion) {
      throw createError("Suggestion non trouvée", 404, "SUGGESTION_NOT_FOUND");
    }

    // Vérifier les permissions : seul le propriétaire ou un admin peut supprimer
    if (!isAdmin && existingSuggestion.userId !== userId) {
      throw createError("Accès refusé", 403, "FORBIDDEN");
    }

    // Supprimer la suggestion
    await prisma.improvementSuggestion.delete({
      where: { id: suggestionId },
    });

    logger.info(`Suggestion supprimée: ${suggestionId} par l'utilisateur ${userId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`Erreur lors de la suppression de la suggestion: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère les statistiques des suggestions (pour les admins)
 */
export async function getImprovementSuggestionStats() {
  try {
    const totalSuggestions = await prisma.improvementSuggestion.count();
    
    // Compter les suggestions par utilisateur
    const suggestionsByUser = await prisma.improvementSuggestion.groupBy({
      by: ['userId'],
      _count: {
        id: true,
      },
    });

    return {
      totalSuggestions,
      uniqueUsers: suggestionsByUser.length,
      averagePerUser: totalSuggestions > 0 ? Math.round((totalSuggestions / suggestionsByUser.length) * 10) / 10 : 0,
    };
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des statistiques des suggestions: ${error.message}`);
    throw error;
  }
}

