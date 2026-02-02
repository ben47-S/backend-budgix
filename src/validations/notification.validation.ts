/**
 * Schémas de validation Zod pour les notifications push
 * 
 * Permet de valider :
 * - L'enregistrement d'un token
 * - La mise à jour des préférences
 * - La suppression d'un token
 */

import { z } from 'zod';

/**
 * Schéma pour enregistrer un token
 */
export const registerTokenSchema = {
  body: z.object({
    token: z
      .string()
      .min(1, 'Le token est requis')
      .regex(/^ExponentPushToken\[.+\]$/, 'Format de token Expo invalide'),
    platform: z.enum(['ios', 'android', 'web'], {
      message: 'Platform doit être ios, android ou web',
    }),
    deviceId: z.string().optional(),
  }),
};

/**
 * Schéma pour mettre à jour les préférences
 */
export const updatePreferencesSchema = {
  params: z.object({
    tokenId: z.string().cuid('Format d\'ID de token invalide'),
  }),
  body: z.object({
    enabled: z.boolean().optional(),
    budgetAlerts: z.boolean().optional(),
    reminders: z.boolean().optional(),
  }),
};

/**
 * Schéma pour supprimer un token
 */
export const deleteTokenSchema = {
  params: z.object({
    tokenId: z.string().cuid('Format d\'ID de token invalide'),
  }),
};

