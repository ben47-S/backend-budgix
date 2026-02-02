/**
 * Contrôleur pour la gestion des discussions de support client
 * 
 * Ce contrôleur gère les requêtes HTTP pour :
 * - Créer et récupérer les discussions
 * - Envoyer et récupérer les messages
 * - Marquer les messages comme lus
 * - Fermer les discussions (admin uniquement)
 */

import type { Request, Response, NextFunction } from "express";
import {
  createDiscussion,
  getDiscussionById,
  getUserDiscussions,
  getAllOpenDiscussions,
  sendMessage,
  markDiscussionAsRead,
  closeDiscussion,
} from "../services/discussion.service";
import { createError } from "../middleware/errorHandler";
import logger from "../lib/logger";

/**
 * Crée une nouvelle discussion pour l'utilisateur authentifié
 */
export async function createDiscussionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const discussion = await createDiscussion(userId);

    res.status(201).json({
      success: true,
      message: "Discussion créée avec succès",
      data: discussion,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la création de la discussion: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère une discussion par son ID
 */
export async function getDiscussionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { discussionId } = req.params;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!discussionId || typeof discussionId !== "string") {
      return next(createError("ID de discussion invalide", 400, "INVALID_INPUT"));
    }

    const discussion = await getDiscussionById(discussionId, userId, isAdmin);

    res.json({
      success: true,
      data: discussion,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de la discussion: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère toutes les discussions de l'utilisateur authentifié
 */
export async function getUserDiscussionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    const discussions = await getUserDiscussions(userId);

    res.json({
      success: true,
      data: discussions,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des discussions: ${error.message}`);
    next(error);
  }
}

/**
 * Récupère toutes les discussions ouvertes (admin uniquement)
 */
export async function getAllOpenDiscussionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const discussions = await getAllOpenDiscussions();

    res.json({
      success: true,
      data: discussions,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des discussions ouvertes: ${error.message}`);
    next(error);
  }
}

/**
 * Envoie un message dans une discussion
 */
export async function sendMessageController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!discussionId || typeof discussionId !== "string") {
      return next(createError("ID de discussion invalide", 400, "INVALID_INPUT"));
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return next(createError("Le contenu du message est requis", 400, "INVALID_INPUT"));
    }

    if (content.length > 5000) {
      return next(createError("Le message ne peut pas dépasser 5000 caractères", 400, "INVALID_INPUT"));
    }

    const message = await sendMessage(
      discussionId,
      content,
      isAdmin ? null : userId,
      isAdmin ? "ADMIN" : "USER"
    );

    res.status(201).json({
      success: true,
      message: "Message envoyé avec succès",
      data: message,
    });
  } catch (error: any) {
    logger.error(`Erreur lors de l'envoi du message: ${error.message}`);
    next(error);
  }
}

/**
 * Marque tous les messages d'une discussion comme lus
 */
export async function markDiscussionAsReadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { discussionId } = req.params;
    const userId = req.userId;
    const isAdmin = req.user?.role === "ADMIN";

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!discussionId || typeof discussionId !== "string") {
      return next(createError("ID de discussion invalide", 400, "INVALID_INPUT"));
    }

    if (!discussionId || typeof discussionId !== "string") {
      return next(createError("ID de discussion invalide", 400, "INVALID_INPUT"));
    }

    await markDiscussionAsRead(discussionId, userId, isAdmin);

    res.json({
      success: true,
      message: "Messages marqués comme lus",
    });
  } catch (error: any) {
    logger.error(`Erreur lors du marquage des messages comme lus: ${error.message}`);
    next(error);
  }
}

/**
 * Ferme une discussion (admin uniquement)
 */
export async function closeDiscussionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { discussionId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return next(createError("Utilisateur non authentifié", 401, "UNAUTHORIZED"));
    }

    if (!discussionId || typeof discussionId !== "string") {
      return next(createError("ID de discussion invalide", 400, "INVALID_INPUT"));
    }

    await closeDiscussion(discussionId, userId, true);

    res.json({
      success: true,
      message: "Discussion fermée avec succès",
    });
  } catch (error: any) {
    logger.error(`Erreur lors de la fermeture de la discussion: ${error.message}`);
    next(error);
  }
}

