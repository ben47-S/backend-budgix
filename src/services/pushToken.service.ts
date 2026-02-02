/**
 * Service de gestion des tokens de notification push
 * 
 * Ce service gère :
 * - L'enregistrement et la mise à jour des tokens
 * - La récupération des tokens actifs
 * - La suppression des tokens
 * - La gestion des préférences de notification
 */

import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { isExpoPushToken } from './expo-notification.service';

/**
 * Enregistre ou met à jour un token de notification push
 * 
 * @param userId - ID de l'utilisateur
 * @param token - Token Expo (format: ExponentPushToken[...])
 * @param platform - Plateforme ("ios" | "android" | "web")
 * @param deviceId - Identifiant unique de l'appareil (optionnel)
 * @returns Token créé ou mis à jour
 */
export async function upsertPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceId?: string
) {
  // Vérifier que le token est valide
  if (!isExpoPushToken(token)) {
    throw createError(
      'Token Expo invalide. Format attendu: ExponentPushToken[...]',
      400,
      'INVALID_EXPO_TOKEN'
    );
  }

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
  }

  // Chercher un token existant par token (le token appartient à l'appareil, pas au compte)
  // Le token peut être réassigné à un autre utilisateur si quelqu'un d'autre se connecte sur le même appareil
  const existingToken = await prisma.pushToken.findFirst({
    where: {
      token, // Chercher uniquement par token (appareil), pas par userId
    },
  });

  if (existingToken) {
    // Mettre à jour le token existant et réassigner au nouvel utilisateur si différent
    // C'est ici que se fait la réassignation dynamique : le token appartient à l'appareil,
    // mais est assigné au compte actif au moment de l'enregistrement
    return prisma.pushToken.update({
      where: { id: existingToken.id },
      data: {
        token,
        platform,
        userId, // ⚠️ IMPORTANT : Réassigner au nouvel utilisateur (réassignation dynamique)
        deviceId: deviceId || existingToken.deviceId,
        updatedAt: new Date(),
      },
    });
  }

  // Créer un nouveau token
  return prisma.pushToken.create({
    data: {
      token,
      platform,
      deviceId: deviceId ?? null, // Convertir undefined en null pour Prisma
      userId,
    },
  });
}

/**
 * Récupère tous les tokens actifs d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Liste des tokens actifs
 */
export async function getActivePushTokens(userId: string) {
  return prisma.pushToken.findMany({
    where: {
      userId,
      enabled: true,
    },
    select: {
      id: true,
      token: true,
      platform: true,
      deviceId: true,
      enabled: true, // Inclure enabled pour le filtrage dans notification.service.ts
      budgetAlerts: true,
      reminders: true,
      subscriptionReminders: true, // Préférence pour les rappels d'abonnements externes
    },
  });
}

/**
 * Supprime un token (quand l'utilisateur se déconnecte ou désinstalle l'app)
 * 
 * ⚠️ IMPORTANT : Le token appartient à l'appareil, pas au compte.
 * Quand un utilisateur se déconnecte, on supprime le token pour cet appareil.
 * Si un autre utilisateur se connecte sur le même appareil, il réenregistrera le token
 * et celui-ci sera réassigné à son compte (via upsertPushToken).
 * 
 * @param tokenId - ID du token à supprimer
 * @param userId - ID de l'utilisateur (pour vérifier l'autorisation)
 * @returns ID du token supprimé
 */
export async function deletePushToken(tokenId: string, userId: string) {
  const token = await prisma.pushToken.findFirst({
    where: {
      id: tokenId,
      userId,
    },
  });

  if (!token) {
    throw createError(
      'Token non trouvé ou vous n\'avez pas l\'autorisation de le supprimer',
      404,
      'TOKEN_NOT_FOUND'
    );
  }

  await prisma.pushToken.delete({
    where: { id: tokenId },
  });

  return { id: tokenId };
}

/**
 * Supprime tous les tokens d'un utilisateur (utile lors de la déconnexion)
 * 
 * ⚠️ IMPORTANT : Cette fonction supprime tous les tokens de l'utilisateur.
 * Si l'utilisateur se reconnecte sur le même appareil, le token sera réenregistré
 * et réassigné à son compte via upsertPushToken.
 * 
 * @param userId - ID de l'utilisateur
 * @returns Nombre de tokens supprimés
 */
export async function deleteAllUserPushTokens(userId: string) {
  const result = await prisma.pushToken.deleteMany({
    where: { userId },
  });

  return { count: result.count };
}

/**
 * Supprime un token par sa valeur (token string)
 * Utile quand on connaît le token mais pas son ID
 * 
 * @param token - Token Expo à supprimer
 * @param userId - ID de l'utilisateur (pour vérifier l'autorisation)
 */
export async function deletePushTokenByValue(token: string, userId: string) {
  const tokenRecord = await prisma.pushToken.findFirst({
    where: {
      token,
      userId,
    },
  });

  if (!tokenRecord) {
    throw createError(
      'Token non trouvé ou vous n\'avez pas l\'autorisation de le supprimer',
      404,
      'TOKEN_NOT_FOUND'
    );
  }

  await prisma.pushToken.delete({
    where: { id: tokenRecord.id },
  });

  return { id: tokenRecord.id };
}

/**
 * Met à jour les préférences de notification pour un token
 * 
 * @param userId - ID de l'utilisateur
 * @param tokenId - ID du token
 * @param preferences - Préférences à mettre à jour
 * @returns Token mis à jour
 */
export async function updateNotificationPreferences(
  userId: string,
  tokenId: string,
  preferences: {
    enabled?: boolean;
    budgetAlerts?: boolean;
    reminders?: boolean;
  }
) {
  const token = await prisma.pushToken.findFirst({
    where: {
      id: tokenId,
      userId,
    },
  });

  if (!token) {
    throw createError('Token non trouvé', 404, 'TOKEN_NOT_FOUND');
  }

  return prisma.pushToken.update({
    where: { id: tokenId },
    data: preferences,
  });
}

/**
 * Récupère les préférences de notification d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Préférences et liste des tokens
 */
export async function getNotificationPreferences(userId: string) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: {
      id: true,
      platform: true,
      deviceId: true,
      enabled: true,
      budgetAlerts: true,
      reminders: true,
      createdAt: true,
    },
  });

  return {
    tokens,
    // Préférences globales (si tous les tokens ont les mêmes préférences)
    global: {
      enabled: tokens.length > 0 && tokens.every(t => t.enabled),
      budgetAlerts: tokens.length > 0 && tokens.every(t => t.budgetAlerts),
      reminders: tokens.length > 0 && tokens.every(t => t.reminders),
    },
  };
}

