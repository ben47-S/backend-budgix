/**
 * Routes pour les paiements Wave d'abonnement premium
 * 
 * Routes disponibles :
 * - POST /payments/initiate
 * - POST /payments/confirm
 * - GET /payments/status/:paymentId
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  initiatePaymentController,
  confirmPaymentController,
  getPaymentStatusController,
} from "../controllers";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit";
import {
  initiatePaymentSchema,
  confirmPaymentSchema,
  paymentStatusSchema,
} from "../validations/payment.validation";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /payments/initiate:
 *   post:
 *     summary: Initier un paiement Wave
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
 *               - plan
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [MONTHLY, ANNUAL]
 *     responses:
 *       201:
 *         description: Paiement initié
 */
router.post(
  "/initiate",
  requireAuth,
  createResourceRateLimiter,
  validate(initiatePaymentSchema),
  initiatePaymentController
);

/**
 * @swagger
 * /payments/confirm:
 *   post:
 *     summary: Confirmer un paiement Wave
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
 *               - paymentId
 *               - waveTransactionId
 *               - senderName
 *               - transferDate
 *             properties:
 *               paymentId:
 *                 type: string
 *               waveTransactionId:
 *                 type: string
 *               senderName:
 *                 type: string
 *               transferDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Paiement soumis pour vérification
 */
router.post(
  "/confirm",
  requireAuth,
  createResourceRateLimiter,
  validate(confirmPaymentSchema),
  confirmPaymentController
);

/**
 * @swagger
 * /payments/status/{paymentId}:
 *   get:
 *     summary: Statut d'un paiement
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut du paiement
 */
router.get(
  "/status/:paymentId",
  requireAuth,
  generalRateLimiter,
  validate(paymentStatusSchema),
  getPaymentStatusController
);

export default router;
