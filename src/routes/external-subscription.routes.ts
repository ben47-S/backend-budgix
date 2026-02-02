/**
 * Routes pour la gestion des abonnements externes (fonctionnalité premium)
 * 
 * Routes disponibles :
 * - GET /external-subscriptions - Liste tous les abonnements avec filtres
 * - GET /external-subscriptions/:id - Détails d'un abonnement
 * - POST /external-subscriptions - Crée un nouvel abonnement
 * - PUT /external-subscriptions/:id - Met à jour un abonnement
 * - DELETE /external-subscriptions/:id - Supprime un abonnement
 * - POST /external-subscriptions/:id/renew - Marque comme renouvelé
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getExternalSubscriptionsController,
  getExternalSubscriptionController,
  createExternalSubscriptionController,
  updateExternalSubscriptionController,
  deleteExternalSubscriptionController,
  renewExternalSubscriptionController,
} from "../controllers";
import { requireAuth, requirePremium } from "../middleware/auth";
import { generalRateLimiter, createResourceRateLimiter } from "../middleware/rateLimit";
import { validate } from "../middleware/validation";
import {
  createExternalSubscriptionSchema,
  updateExternalSubscriptionSchema,
  getExternalSubscriptionsSchema,
  externalSubscriptionIdSchema,
  renewExternalSubscriptionSchema,
} from "../validations/external-subscription.validation";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /external-subscriptions:
 *   get:
 *     summary: Liste tous les abonnements externes
 *     description: Récupère la liste des abonnements externes avec filtres et calcule le total mensuel (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut actif/inactif
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Nombre maximum d'abonnements à retourner
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Nombre d'abonnements à ignorer (pour la pagination)
 *     responses:
 *       200:
 *         description: Liste des abonnements récupérée avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.get(
  "/",
  requireAuth,
  requirePremium,
  generalRateLimiter,
  validate(getExternalSubscriptionsSchema),
  getExternalSubscriptionsController
);

/**
 * @swagger
 * /external-subscriptions/{id}:
 *   get:
 *     summary: Récupère les détails d'un abonnement
 *     description: Récupère les détails d'un abonnement externe spécifique (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'abonnement
 *     responses:
 *       200:
 *         description: Détails de l'abonnement récupérés avec succès
 *       404:
 *         description: Abonnement non trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.get(
  "/:id",
  requireAuth,
  requirePremium,
  generalRateLimiter,
  validate(externalSubscriptionIdSchema),
  getExternalSubscriptionController
);

/**
 * @swagger
 * /external-subscriptions:
 *   post:
 *     summary: Crée un nouvel abonnement externe
 *     description: Crée un nouvel abonnement externe et calcule automatiquement la date du prochain renouvellement (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - amount
 *               - startDate
 *               - billingCycle
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Netflix"
 *               amount:
 *                 type: integer
 *                 example: 5000
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "15-01-2024"
 *               billingCycle:
 *                 type: string
 *                 enum: [MONTHLY, QUARTERLY, ANNUAL, CUSTOM]
 *                 example: "MONTHLY"
 *               customDays:
 *                 type: integer
 *                 example: 45
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Abonnement créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.post(
  "/",
  requireAuth,
  requirePremium,
  createResourceRateLimiter,
  validate(createExternalSubscriptionSchema),
  createExternalSubscriptionController
);

/**
 * @swagger
 * /external-subscriptions/{id}:
 *   put:
 *     summary: Met à jour un abonnement externe
 *     description: Met à jour un abonnement externe et recalcule automatiquement la date du prochain renouvellement si nécessaire (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'abonnement
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               amount:
 *                 type: integer
 *               startDate:
 *                 type: string
 *                 format: date
 *               billingCycle:
 *                 type: string
 *                 enum: [MONTHLY, QUARTERLY, ANNUAL, CUSTOM]
 *               customDays:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Abonnement mis à jour avec succès
 *       404:
 *         description: Abonnement non trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.put(
  "/:id",
  requireAuth,
  requirePremium,
  createResourceRateLimiter,
  validate({
    params: externalSubscriptionIdSchema.params,
    body: updateExternalSubscriptionSchema.body,
  }),
  updateExternalSubscriptionController
);

/**
 * @swagger
 * /external-subscriptions/{id}:
 *   delete:
 *     summary: Supprime un abonnement externe
 *     description: Supprime définitivement un abonnement externe (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'abonnement
 *     responses:
 *       200:
 *         description: Abonnement supprimé avec succès
 *       404:
 *         description: Abonnement non trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.delete(
  "/:id",
  requireAuth,
  requirePremium,
  createResourceRateLimiter,
  validate(externalSubscriptionIdSchema),
  deleteExternalSubscriptionController
);

/**
 * @swagger
 * /external-subscriptions/{id}/renew:
 *   post:
 *     summary: Marque un abonnement comme renouvelé
 *     description: Met à jour la date de début et recalcule la date du prochain renouvellement. Réactive l'abonnement s'il était désactivé (fonctionnalité premium)
 *     tags: [External Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'abonnement
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               renewalDate:
 *                 type: string
 *                 format: date
 *                 description: "Date de renouvellement (optionnel, défaut: maintenant)"
 *     responses:
 *       200:
 *         description: Abonnement renouvelé avec succès
 *       404:
 *         description: Abonnement non trouvé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 */
router.post(
  "/:id/renew",
  requireAuth,
  requirePremium,
  createResourceRateLimiter,
  validate({
    params: externalSubscriptionIdSchema.params,
    body: renewExternalSubscriptionSchema.body,
  }),
  renewExternalSubscriptionController
);

export default router;

