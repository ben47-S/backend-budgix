/**
 * Routes pour les demandes d'abonnement premium (utilisateur)
 * Système simplifié sans Wave
 *
 * Routes disponibles :
 * - POST /payments/requests - Créer une demande premium
 * - GET /payments/requests/pending - Voir sa demande en attente
 * - GET /payments/requests/:requestId/status - Statut d'une demande
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createRequestController,
  getUserPendingRequestController,
  getRequestStatusController,
} from "../controllers/payment.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit.js";
import {
  createRequestSchema,
  requestStatusSchema,
} from "../validations/payment.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /payments/requests:
 *   post:
 *     summary: Créer une demande d'abonnement premium
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planType
 *             properties:
 *               planType:
 *                 type: string
 *                 enum: [MONTHLY, ANNUAL]
 *                 description: Type d'abonnement (Mensuel ou Annuel)
 *     responses:
 *       201:
 *         description: Demande créée avec succès
 *       400:
 *         description: Demande déjà en attente
 */
router.post(
  "/requests",
  requireAuth,
  createResourceRateLimiter,
  validate(createRequestSchema),
  createRequestController
);

/**
 * @swagger
 * /payments/requests/pending:
 *   get:
 *     summary: Récupère la demande en attente de l'utilisateur
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demande en attente (null si aucune)
 */
router.get(
  "/requests/pending",
  requireAuth,
  generalRateLimiter,
  getUserPendingRequestController
);

/**
 * @swagger
 * /payments/requests/{requestId}/status:
 *   get:
 *     summary: Statut d'une demande
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut de la demande
 *       404:
 *         description: Demande introuvable
 */
router.get(
  "/requests/:requestId/status",
  requireAuth,
  generalRateLimiter,
  validate(requestStatusSchema),
  getRequestStatusController
);

export default router;
