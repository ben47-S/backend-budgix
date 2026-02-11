/**
 * Routes pour la gestion des abonnements premium
 * 
 * Routes disponibles :
 * - POST /subscriptions - Créer ou mettre à jour un abonnement
 * - GET /subscriptions - Récupérer l'abonnement de l'utilisateur
 * - POST /subscriptions/check-status - Vérifier et mettre à jour le statut premium
 * - POST /subscriptions/cancel - Annuler l'abonnement
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createSubscriptionController,
  getSubscriptionController,
  checkSubscriptionStatusController,
  cancelSubscriptionController,
  getSubscriptionProgressController,
} from "../controllers";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit";
import { createSubscriptionSchema } from "../validations/subscription.validation";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /subscriptions:
 *   post:
 *     summary: Créer ou mettre à jour un abonnement
 *     description: Crée un nouvel abonnement ou met à jour l'abonnement existant. Active automatiquement le statut premium.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [MONTHLY, ANNUAL]
 *                 example: "MONTHLY"
 *                 description: "Plan d'abonnement (MONTHLY: 1.09 USD, ANNUAL: 10.99 USD)"
 *     responses:
 *       200:
 *         description: Abonnement créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Plan d'abonnement invalide
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", requireAuth, createResourceRateLimiter, validate(createSubscriptionSchema), createSubscriptionController);

/**
 * @swagger
 * /subscriptions:
 *   get:
 *     summary: Récupérer les détails de l'abonnement
 *     description: Récupère toutes les informations détaillées de l'abonnement de l'utilisateur connecté (statut, jours restants, prix formaté, etc.)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Détails de l'abonnement récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         plan:
 *                           type: string
 *                           enum: [MONTHLY, ANNUAL]
 *                         price:
 *                           type: number
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     isActive:
 *                       type: boolean
 *                       description: Si l'abonnement est actif
 *                     isPremium:
 *                       type: boolean
 *                       description: Si l'utilisateur a le statut premium
 *                     daysRemaining:
 *                       type: integer
 *                       nullable: true
 *                       description: Nombre de jours restants avant expiration
 *                     nextRenewalDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Date du prochain renouvellement
 *                     formattedPrice:
 *                       type: string
 *                       nullable: true
 *                       description: 'Prix formaté en XOF (ex: "4 200 XOF")'
 *                     formattedPlan:
 *                       type: string
 *                       nullable: true
 *                       description: 'Plan formaté (ex: "Mensuel" ou "Annuel")'
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, EXPIRED, CANCELLED, NO_SUBSCRIPTION]
 *                       description: Statut de l'abonnement
 *                     monthlyPrice:
 *                       type: number
 *                       description: Prix mensuel de base en XOF
 *                     annualPrice:
 *                       type: number
 *                       description: Prix annuel de base en XOF
 *                     savings:
 *                       type: string
 *                       nullable: true
 *                       description: Économies réalisées avec l'abonnement annuel
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, getSubscriptionController);

/**
 * @swagger
 * /subscriptions/check-status:
 *   post:
 *     summary: Vérifier le statut premium
 *     description: Vérifie et met à jour le statut premium de l'utilisateur selon son abonnement
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut vérifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isPremium:
 *                       type: boolean
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                       nullable: true
 *                     isActive:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/check-status", requireAuth, generalRateLimiter, checkSubscriptionStatusController);

/**
 * @swagger
 * /subscriptions/cancel:
 *   post:
 *     summary: Annuler l'abonnement
 *     description: Annule l'abonnement de l'utilisateur connecté et retire le statut premium
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Abonnement annulé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Aucun abonnement trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/cancel", requireAuth, generalRateLimiter, cancelSubscriptionController);

/**
 * @swagger
 * /subscriptions/progress:
 *   get:
 *     summary: Récupérer la progression de l'abonnement premium
 *     description: Récupère les informations détaillées sur la progression de l'abonnement premium (pourcentage, jours écoulés, jours restants, date de fin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progression de l'abonnement récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     isActive:
 *                       type: boolean
 *                       description: Si l'abonnement est actif
 *                     progressPercentage:
 *                       type: number
 *                       nullable: true
 *                       description: Pourcentage de progression (0-100), null si pas de date de fin
 *                       example: 45.5
 *                     daysElapsed:
 *                       type: integer
 *                       description: Nombre de jours écoulés depuis le début
 *                       example: 15
 *                     daysRemaining:
 *                       type: integer
 *                       nullable: true
 *                       description: Nombre de jours restants avant expiration, null si pas de date de fin
 *                       example: 15
 *                     totalDays:
 *                       type: integer
 *                       nullable: true
 *                       description: Durée totale de l'abonnement en jours, null si pas de date de fin
 *                       example: 30
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       description: Date de début de l'abonnement
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Date de fin de l'abonnement
 *                     plan:
 *                       type: string
 *                       enum: [MONTHLY, ANNUAL]
 *                       description: Plan d'abonnement
 *       404:
 *         description: Aucun abonnement trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/progress", requireAuth, generalRateLimiter, getSubscriptionProgressController);

export default router;

