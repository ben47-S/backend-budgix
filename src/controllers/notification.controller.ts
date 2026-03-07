/**
 * Contrôleur de gestion des notifications push
 * 
 * Gère les requêtes HTTP liées aux notifications :
 * - Enregistrement/mise à jour d'un token
 * - Récupération des préférences
 * - Mise à jour des préférences
 * - Suppression d'un token
 */

import type { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler.js';
import logger from '../lib/logger.js';
import {
  upsertPushToken,
  deletePushToken,
  updateNotificationPreferences,
  getNotificationPreferences,
} from '../services/pushToken.service.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  deleteNotification,
  deleteAllNotifications,
} from '../services/notification.service.js';

/**
 * Enregistre ou met à jour un token de notification
 * 
 * POST /api/notifications/token
 * Body: { token: string, platform: "ios" | "android" | "web", deviceId?: string }
 */
export async function registerTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const { token, platform, deviceId } = req.body;

    const pushToken = await upsertPushToken(userId, token, platform, deviceId);

    // Logger le token enregistré (pour debug)
    logger.info('Push token enregistré/réassigné', {
      userId,
      tokenId: pushToken.id,
      platform: pushToken.platform,
      deviceId: pushToken.deviceId,
      token: process.env.NODE_ENV === 'production' 
        ? pushToken.token.substring(0, 30) + '...' // En production, logger seulement le début pour la sécurité
        : pushToken.token, // En développement, logger le token complet
    });

    res.status(201).json({
      success: true,
      message: 'Token enregistré avec succès',
      data: pushToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les préférences de notification
 * 
 * GET /api/notifications/preferences
 */
export async function getPreferencesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const preferences = await getNotificationPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour les préférences de notification
 * 
 * PUT /api/notifications/preferences/:tokenId
 * Body: { enabled?: boolean, budgetAlerts?: boolean, reminders?: boolean }
 */
export async function updatePreferencesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const { tokenId } = req.params;
    
    // Valider que tokenId est une string
    if (!tokenId || typeof tokenId !== 'string') {
      throw createError('Token ID invalide', 400, 'INVALID_TOKEN_ID');
    }

    const preferences = req.body;

    const updated = await updateNotificationPreferences(
      userId,
      tokenId,
      preferences
    );

    res.json({
      success: true,
      message: 'Préférences mises à jour',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un token
 * 
 * DELETE /api/notifications/token/:tokenId
 */
export async function deleteTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const { tokenId } = req.params;

    // Valider que tokenId est une string
    if (!tokenId || typeof tokenId !== 'string') {
      throw createError('Token ID invalide', 400, 'INVALID_TOKEN_ID');
    }

    await deletePushToken(tokenId, userId);

    res.json({
      success: true,
      message: 'Token supprimé avec succès',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les notifications de l'utilisateur
 * 
 * GET /api/notifications
 * Query: { read?: boolean, limit?: number, offset?: number }
 */
export async function getNotificationsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    // Construire l'objet options conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
    const options: {
      read?: boolean;
      limit?: number;
      offset?: number;
    } = {};
    
    if (read !== undefined) {
      options.read = read;
    }
    if (limit !== undefined) {
      options.limit = limit;
    }
    if (offset !== undefined) {
      options.offset = offset;
    }

    const notifications = await getUserNotifications(userId, options);

    // Récupérer aussi le nombre de notifications non lues
    const unreadCount = await getUnreadNotificationsCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total: notifications.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Marque une notification comme lue
 * 
 * PUT /api/notifications/:id/read
 */
export async function markNotificationAsReadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    
    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError('ID de notification requis', 400, 'MISSING_NOTIFICATION_ID');
    }

    const notification = await markNotificationAsRead(userId, id);

    res.json({
      success: true,
      message: 'Notification marquée comme lue',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Marque toutes les notifications comme lues
 * 
 * PUT /api/notifications/read-all
 */
export async function markAllNotificationsAsReadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const count = await markAllNotificationsAsRead(userId);

    res.json({
      success: true,
      message: `${count} notification(s) marquée(s) comme lue(s)`,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère le nombre de notifications non lues
 *
 * GET /api/notifications/unread-count
 */
export async function getUnreadNotificationsCountController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const count = await getUnreadNotificationsCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une notification spécifique
 *
 * DELETE /api/notifications/:id
 */
export async function deleteNotificationController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Valider que id est une string
    if (!id || typeof id !== 'string') {
      throw createError('ID de notification requis', 400, 'MISSING_NOTIFICATION_ID');
    }

    await deleteNotification(userId, id);

    res.json({
      success: true,
      message: 'Notification supprimée avec succès',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime toutes les notifications de l'utilisateur
 *
 * DELETE /api/notifications/all
 */
export async function deleteAllNotificationsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError('Authentification requise', 401, 'UNAUTHORIZED');
    }

    const count = await deleteAllNotifications(userId);

    res.json({
      success: true,
      message: `${count} notification(s) supprimée(s)`,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

