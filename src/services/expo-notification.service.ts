/**
 * Service pour envoyer des notifications push via Expo Push Notification Service
 * 
 * Ce service gère :
 * - L'envoi de notifications push à des tokens Expo
 * - La validation des tokens Expo
 * - La vérification des erreurs de notification
 */

import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import logger from '../lib/logger.js';

// Créer une instance Expo (réutilisable)
const expo = new Expo({
  ...(process.env.EXPO_ACCESS_TOKEN && { accessToken: process.env.EXPO_ACCESS_TOKEN }), // Optionnel, pour les stats avancées
  useFcmV1: true, // Utiliser FCM v1 (recommandé pour Android)
});

/**
 * Vérifie si un token Expo est valide
 * 
 * @param token - Token à vérifier
 * @returns true si le token est valide, false sinon
 */
export function isExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

/**
 * Envoie une notification push à un ou plusieurs tokens
 * 
 * @param tokens - Tableau de tokens Expo
 * @param title - Titre de la notification
 * @param body - Corps de la notification
 * @param data - Données supplémentaires (optionnel)
 * @param sound - Son de la notification (default: "default")
 * @param priority - Priorité ("default" | "normal" | "high")
 * @returns Tableau de tickets Expo
 */
export async function sendExpoPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  sound: 'default' | null = 'default',
  priority: 'default' | 'normal' | 'high' = 'default'
): Promise<ExpoPushTicket[]> {
  // Filtrer les tokens valides
  const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));

  if (validTokens.length === 0) {
    throw new Error('Aucun token Expo valide fourni');
  }

  // Créer les messages
  const messages: ExpoPushMessage[] = validTokens.map(token => ({
    to: token,
    sound,
    title,
    body,
    data: data || {},
    priority,
    channelId: 'default', // Canal de notification (Android)
  }));

  // Expo limite à 100 messages par requête, donc on divise en chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  // Envoyer chaque chunk
  for (const chunk of chunks) {
    try {
      logger.debug('Envoi d\'un chunk de notifications Expo', {
        chunkSize: chunk.length,
        totalChunks: chunks.length,
      });
      
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      
      logger.debug('Chunk de notifications envoyé', {
        chunkSize: chunk.length,
        ticketsReceived: ticketChunk.length,
      });
    } catch (error) {
      logger.error('Erreur lors de l\'envoi d\'un chunk de notifications Expo', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
        chunkSize: chunk.length,
      });
      throw error;
    }
  }

  logger.info('Notifications Expo envoyées', {
    totalTokens: validTokens.length,
    totalTickets: tickets.length,
    chunksCount: chunks.length,
  });

  return tickets;
}

/**
 * Vérifie les tickets pour voir s'il y a des erreurs
 * Utile pour nettoyer les tokens invalides de la base de données
 * 
 * @param ticketIds - Tableau d'IDs de tickets à vérifier
 */
export async function checkPushTicketReceipts(
  ticketIds: string[]
): Promise<void> {
  const receiptIds = ticketIds.filter(
    (id): id is string => id !== null && typeof id === 'string'
  );
  
  if (receiptIds.length === 0) {
    return;
  }

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  
  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      
      // Traiter les erreurs et les succès
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') {
          logger.info('✅ [SUCCESS] Notification Expo livrée avec succès', {
            status: 'EXPO_DELIVERED',
            receiptId,
            details: receipt.details,
          });
          // Log supplémentaire très visible
          const green = '\x1b[32m';
          const reset = '\x1b[0m';
          console.log('\n' + green + '='.repeat(80) + reset);
          console.log(green + '✅ [EXPO] NOTIFICATION LIVRÉE PAR EXPO AVEC SUCCÈS' + reset);
          console.log(green + '='.repeat(80) + reset);
          console.log(`📄 Receipt ID: ${receiptId}`);
          console.log(`📊 Status: ${receipt.status}`);
          if (receipt.details) {
            console.log(`📋 Détails: ${JSON.stringify(receipt.details, null, 2)}`);
          }
          console.log(green + '='.repeat(80) + reset + '\n');
        } else if (receipt.status === 'error') {
          logger.error('❌ [ERROR] Erreur de notification Expo détectée', {
            status: 'EXPO_ERROR',
            receiptId,
            message: receipt.message,
            details: receipt.details,
          });
          // Log supplémentaire très visible
          const red = '\x1b[31m';
          const reset = '\x1b[0m';
          console.log('\n' + red + '='.repeat(80) + reset);
          console.log(red + '❌ [EXPO] ERREUR DE LIVRAISON EXPO' + reset);
          console.log(red + '='.repeat(80) + reset);
          console.log(`📄 Receipt ID: ${receiptId}`);
          console.log(`📊 Status: ${receipt.status}`);
          console.log(`⚠️  Message: ${receipt.message || 'Aucun message'}`);
          if (receipt.details) {
            console.log(`📋 Détails: ${JSON.stringify(receipt.details, null, 2)}`);
          }
          console.log(red + '='.repeat(80) + reset + '\n');
          
          // Si le token est invalide, on peut le supprimer de la DB
          if (receipt.details?.error === 'DeviceNotRegistered') {
            logger.warn('⚠️ Token Expo invalide détecté (DeviceNotRegistered)', {
              receiptId,
              message: receipt.message,
              action: 'Le token devrait être supprimé de la base de données',
            });
            // TODO: Supprimer le token de la base de données
          } else if (receipt.details?.error === 'MessageTooBig') {
            logger.warn('⚠️ Message de notification trop volumineux', {
              receiptId,
              message: receipt.message,
            });
          } else if (receipt.details?.error === 'MessageRateExceeded') {
            logger.warn('⚠️ Trop de messages envoyés à cet appareil', {
              receiptId,
              message: receipt.message,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des receipts Expo', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}

