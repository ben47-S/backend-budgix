/**
 * Routes de gestion des notifications push
 * 
 * Permet aux utilisateurs de :
 * - Enregistrer leurs tokens de notification
 * - Gérer leurs préférences de notification
 * - Supprimer leurs tokens
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth";
import { generalRateLimiter } from "../middleware/rateLimit";
import { validate } from "../middleware/validation";
import {
  registerTokenSchema,
  updatePreferencesSchema,
  deleteTokenSchema,
} from "../validations/notification.validation";
import {
  registerTokenController,
  getPreferencesController,
  updatePreferencesController,
  deleteTokenController,
  getNotificationsController,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
  getUnreadNotificationsCountController,
  deleteNotificationController,
  deleteAllNotificationsController,
} from "../controllers";

const router: Router = ExpressRouter();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Gestion des notifications push Expo
 */

/**
 * @swagger
 * /notifications/token:
 *   post:
 *     summary: Enregistrer un token de notification
 *     description: |
 *       Enregistre ou met à jour un token Expo Push Notification.
 *       Si un token existe déjà pour cet appareil, il sera mis à jour.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *                 description: Token Expo Push Notification
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 example: "ios"
 *                 description: Plateforme de l'appareil
 *               deviceId:
 *                 type: string
 *                 example: "iPhone-123"
 *                 description: Identifiant unique de l'appareil (optionnel)
 *     responses:
 *       201:
 *         description: Token enregistré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token enregistré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     token:
 *                       type: string
 *                     platform:
 *                       type: string
 *                     deviceId:
 *                       type: string
 *                       nullable: true
 *                     enabled:
 *                       type: boolean
 *                     budgetAlerts:
 *                       type: boolean
 *                     reminders:
 *                       type: boolean
 *       400:
 *         description: Token invalide ou données manquantes
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Trop de requêtes
 */
router.post(
  "/token",
  requireAuth,
  generalRateLimiter,
  validate(registerTokenSchema),
  registerTokenController
);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Récupérer les préférences de notification
 *     description: Récupère toutes les préférences de notification de l'utilisateur et la liste de ses tokens
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Préférences récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           platform:
 *                             type: string
 *                           deviceId:
 *                             type: string
 *                             nullable: true
 *                           enabled:
 *                             type: boolean
 *                           budgetAlerts:
 *                             type: boolean
 *                           reminders:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     global:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         budgetAlerts:
 *                           type: boolean
 *                         reminders:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/preferences",
  requireAuth,
  generalRateLimiter,
  getPreferencesController
);

/**
 * @swagger
 * /notifications/preferences/{tokenId}:
 *   put:
 *     summary: Mettre à jour les préférences d'un token
 *     description: Met à jour les préférences de notification pour un token spécifique
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du token à mettre à jour
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Activer/désactiver les notifications pour cet appareil
 *               budgetAlerts:
 *                 type: boolean
 *                 description: Activer/désactiver les alertes de budget
 *               reminders:
 *                 type: boolean
 *                 description: Activer/désactiver les rappels
 *     responses:
 *       200:
 *         description: Préférences mises à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Token non trouvé
 */
router.put(
  "/preferences/:tokenId",
  requireAuth,
  generalRateLimiter,
  validate(updatePreferencesSchema),
  updatePreferencesController
);

/**
 * @swagger
 * /notifications/token/{tokenId}:
 *   delete:
 *     summary: Supprimer un token
 *     description: Supprime un token de notification (déconnexion ou désinstallation de l'app)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du token à supprimer
 *     responses:
 *       200:
 *         description: Token supprimé avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Token non trouvé
 */
router.delete(
  "/token/:tokenId",
  requireAuth,
  generalRateLimiter,
  validate(deleteTokenSchema),
  deleteTokenController
);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Récupérer les notifications de l'utilisateur
 *     description: Récupère la liste des notifications de l'utilisateur avec possibilité de filtrer par statut (lues/non lues)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut de lecture (true = lues, false = non lues)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Nombre maximum de notifications à retourner
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Nombre de notifications à ignorer (pour la pagination)
 *     responses:
 *       200:
 *         description: Notifications récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [BUDGET_WARNING, BUDGET_ALERT, TRANSACTION_REMINDER, WEEKLY_SUMMARY]
 *                           title:
 *                             type: string
 *                           body:
 *                             type: string
 *                           data:
 *                             type: object
 *                           read:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     unreadCount:
 *                       type: integer
 *                       description: Nombre de notifications non lues
 *                     total:
 *                       type: integer
 *                       description: Nombre total de notifications retournées
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  requireAuth,
  generalRateLimiter,
  getNotificationsController
);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Récupérer le nombre de notifications non lues
 *     description: Récupère le nombre de notifications non lues pour l'utilisateur
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nombre de notifications non lues récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/unread-count",
  requireAuth,
  generalRateLimiter,
  getUnreadNotificationsCountController
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Marquer une notification comme lue
 *     description: Marque une notification spécifique comme lue
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notification à marquer comme lue
 *     responses:
 *       200:
 *         description: Notification marquée comme lue avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification marquée comme lue"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     read:
 *                       type: boolean
 *                       example: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Notification non trouvée
 */
router.put(
  "/:id/read",
  requireAuth,
  generalRateLimiter,
  markNotificationAsReadController
);

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Marquer toutes les notifications comme lues
 *     description: Marque toutes les notifications non lues de l'utilisateur comme lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications marquées comme lues avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "10 notification(s) marquée(s) comme lue(s)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 10
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/read-all",
  requireAuth,
  generalRateLimiter,
  markAllNotificationsAsReadController
);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Supprimer une notification
 *     description: Supprime une notification spécifique de l'utilisateur
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notification à supprimer
 *     responses:
 *       200:
 *         description: Notification supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification supprimée avec succès"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Notification non trouvée
 */
router.delete(
  "/:id",
  requireAuth,
  generalRateLimiter,
  deleteNotificationController
);

/**
 * @swagger
 * /notifications/all:
 *   delete:
 *     summary: Supprimer toutes les notifications
 *     description: Supprime toutes les notifications de l'utilisateur
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications supprimées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "10 notification(s) supprimée(s)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 10
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete(
  "/all",
  requireAuth,
  generalRateLimiter,
  deleteAllNotificationsController
);

export default router;

