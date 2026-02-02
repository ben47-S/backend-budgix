/**
 * Service de gestion des discussions de support client
 * 
 * Ce service gère :
 * - La création et récupération des discussions
 * - L'envoi et récupération des messages
 * - La suppression automatique des discussions inactives après 25 minutes
 * - La mise à jour de lastActivityAt à chaque message
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import logger from "../lib/logger";

// Durée d'inactivité avant suppression (25 minutes en millisecondes)
const INACTIVITY_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes

/**
 * Crée une nouvelle discussion pour un utilisateur
 */
export async function createDiscussion(userId: string) {
  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError("Utilisateur non trouvé", 404, "USER_NOT_FOUND");
    }

    // Créer la discussion
    const discussion = await prisma.discussion.create({
      data: {
        userId,
        status: "OPEN",
        lastActivityAt: new Date(),
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
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    logger.info(`Discussion créée: ${discussion.id} pour l'utilisateur ${userId}`);
    return discussion;
  } catch (error: any) {
    logger.error(`Erreur lors de la création de la discussion: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère une discussion par son ID
 */
export async function getDiscussionById(discussionId: string, userId?: string, isAdmin: boolean = false) {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            email: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!discussion) {
      throw createError("Discussion non trouvée", 404, "DISCUSSION_NOT_FOUND");
    }

    // Vérifier les permissions : l'utilisateur doit être le propriétaire ou un admin
    if (!isAdmin && discussion.userId !== userId) {
      throw createError("Accès refusé à cette discussion", 403, "FORBIDDEN");
    }

    return discussion;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération de la discussion: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère toutes les discussions d'un utilisateur
 */
export async function getUserDiscussions(userId: string) {
  try {
    const discussions = await prisma.discussion.findMany({
      where: { userId },
      orderBy: {
        lastActivityAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Récupérer seulement le dernier message pour l'aperçu
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return discussions;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des discussions: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère toutes les discussions ouvertes (pour les admins)
 */
export async function getAllOpenDiscussions() {
  try {
    const discussions = await prisma.discussion.findMany({
      where: {
        status: "OPEN",
      },
      orderBy: {
        lastActivityAt: "desc",
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
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Récupérer seulement le dernier message pour l'aperçu
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return discussions;
  } catch (error: any) {
    logger.error(`Erreur lors de la récupération des discussions ouvertes: ${error.message}`);
    throw error;
  }
}

/**
 * Envoie un message dans une discussion
 * Met à jour automatiquement lastActivityAt
 */
export async function sendMessage(
  discussionId: string,
  content: string,
  senderId: string | null,
  senderType: "USER" | "ADMIN"
) {
  try {
    // Vérifier que la discussion existe
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      throw createError("Discussion non trouvée", 404, "DISCUSSION_NOT_FOUND");
    }

    // Vérifier que la discussion n'est pas fermée
    if (discussion.status === "CLOSED") {
      throw createError("Cette discussion est fermée", 400, "DISCUSSION_CLOSED");
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        discussionId,
        senderId: senderType === "USER" ? senderId : null,
        senderType,
        content: content.trim(),
      },
      include: {
        discussion: {
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
        },
      },
    });

    // Mettre à jour lastActivityAt de la discussion
    await prisma.discussion.update({
      where: { id: discussionId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    logger.info(`Message envoyé dans la discussion ${discussionId} par ${senderType}`);
    return message;
  } catch (error: any) {
    logger.error(`Erreur lors de l'envoi du message: ${error.message}`);
    throw error;
  }
}

/**
 * Marque un message comme lu
 */
export async function markMessageAsRead(messageId: string, userId: string, isAdmin: boolean = false) {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        discussion: true,
      },
    });

    if (!message) {
      throw createError("Message non trouvé", 404, "MESSAGE_NOT_FOUND");
    }

    // Vérifier les permissions
    if (!isAdmin && message.discussion.userId !== userId) {
      throw createError("Accès refusé", 403, "FORBIDDEN");
    }

    // Marquer comme lu seulement si le message n'est pas déjà lu
    if (!message.read) {
      await prisma.message.update({
        where: { id: messageId },
        data: { read: true },
      });
    }

    return { success: true };
  } catch (error: any) {
    logger.error(`Erreur lors du marquage du message comme lu: ${error.message}`);
    throw error;
  }
}

/**
 * Marque tous les messages d'une discussion comme lus
 */
export async function markDiscussionAsRead(discussionId: string, userId: string, isAdmin: boolean = false) {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      throw createError("Discussion non trouvée", 404, "DISCUSSION_NOT_FOUND");
    }

    // Vérifier les permissions
    if (!isAdmin && discussion.userId !== userId) {
      throw createError("Accès refusé", 403, "FORBIDDEN");
    }

    // Marquer tous les messages non lus comme lus
    await prisma.message.updateMany({
      where: {
        discussionId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return { success: true };
  } catch (error: any) {
    logger.error(`Erreur lors du marquage de la discussion comme lue: ${error.message}`);
    throw error;
  }
}

/**
 * Ferme une discussion
 */
export async function closeDiscussion(discussionId: string, userId: string, isAdmin: boolean = false) {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      throw createError("Discussion non trouvée", 404, "DISCUSSION_NOT_FOUND");
    }

    // Vérifier les permissions : seul l'admin peut fermer une discussion
    if (!isAdmin) {
      throw createError("Seuls les administrateurs peuvent fermer une discussion", 403, "FORBIDDEN");
    }

    await prisma.discussion.update({
      where: { id: discussionId },
      data: {
        status: "CLOSED",
      },
    });

    logger.info(`Discussion ${discussionId} fermée par l'admin ${userId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`Erreur lors de la fermeture de la discussion: ${error.message}`);
    throw error;
  }
}

/**
 * Supprime les discussions inactives depuis plus de 25 minutes
 * Cette fonction est appelée périodiquement par un job cron
 */
export async function cleanupInactiveDiscussions() {
  try {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - INACTIVITY_THRESHOLD_MS);

    // Trouver toutes les discussions ouvertes inactives depuis plus de 25 minutes
    const inactiveDiscussions = await prisma.discussion.findMany({
      where: {
        status: "OPEN",
        lastActivityAt: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
      },
    });

    if (inactiveDiscussions.length === 0) {
      logger.info("Aucune discussion inactive à supprimer");
      return { deletedCount: 0 };
    }

    // Supprimer les discussions inactives (les messages seront supprimés en cascade)
    const result = await prisma.discussion.deleteMany({
      where: {
        id: {
          in: inactiveDiscussions.map((d) => d.id),
        },
      },
    });

    logger.info(`${result.count} discussion(s) inactive(s) supprimée(s)`);
    return { deletedCount: result.count };
  } catch (error: any) {
    logger.error(`Erreur lors du nettoyage des discussions inactives: ${error.message}`);
    throw error;
  }
}

/**
 * Vérifie si une discussion doit être supprimée (inactive depuis plus de 25 minutes)
 */
export function shouldDeleteDiscussion(lastActivityAt: Date): boolean {
  const now = new Date();
  const timeSinceLastActivity = now.getTime() - lastActivityAt.getTime();
  return timeSinceLastActivity >= INACTIVITY_THRESHOLD_MS;
}

