/**
 * Routes pour la gestion des dettes (fonctionnalité avec limitations pour utilisateurs gratuits)
 *
 * NOTE IMPORTANTE: Les vérifications premium se font au niveau SERVICE (debt.service.ts)
 * via la fonction checkDebtLimit() qui permet:
 * - Utilisateurs gratuits: 1 dette active par type (I_OWE ou OWED_TO_ME)
 * - Utilisateurs premium: Dettes illimitées
 *
 * Routes disponibles :
 * - POST /debts - Créer une nouvelle dette
 * - GET /debts - Récupérer toutes les dettes (avec filtres optionnels)
 * - GET /debts/:id - Récupérer une dette par son ID
 * - PUT /debts/:id - Mettre à jour une dette
 * - DELETE /debts/:id - Supprimer une dette
 * - GET /debts/stats - Récupérer les statistiques des dettes
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createDebtController,
  getDebtsController,
  getDebtByIdController,
  updateDebtController,
  deleteDebtController,
  getDebtStatsController,
} from "../controllers/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit.js";
import {
  createDebtSchema,
  updateDebtSchema,
  getDebtsSchema,
  debtIdSchema,
} from "../validations/debt.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /debts:
 *   post:
 *     summary: Créer une dette
 *     description: Crée une nouvelle dette (fonctionnalité premium uniquement)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - contactName
 *               - amount
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [OWED_TO_ME, I_OWE]
 *                 example: "OWED_TO_ME"
 *                 description: Type de dette (OWED_TO_ME = on me doit, I_OWE = je dois)
 *               contactName:
 *                 type: string
 *                 example: "Jean Dupont"
 *               amount:
 *                 type: number
 *                 example: 100.00
 *               notes:
 *                 type: string
 *                 example: "Prêt pour l'anniversaire"
 *     responses:
 *       201:
 *         description: Dette créée avec succès
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
 *                     debt:
 *                       $ref: '#/components/schemas/Debt'
 *       400:
 *         description: Données invalides
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", requireAuth, createResourceRateLimiter, validate(createDebtSchema), createDebtController);

/**
 * @swagger
 * /debts:
 *   get:
 *     summary: Liste des dettes
 *     description: Récupère toutes les dettes de l'utilisateur avec filtres optionnels (fonctionnalité premium uniquement)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [OWED_TO_ME, I_OWE]
 *         description: Filtrer par type de dette
 *       - in: query
 *         name: isPaid
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut de paiement
 *     responses:
 *       200:
 *         description: Liste des dettes récupérée avec succès
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
 *                     debts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Debt'
 *                     count:
 *                       type: integer
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, validate(getDebtsSchema), getDebtsController);

/**
 * @swagger
 * /debts/stats:
 *   get:
 *     summary: Statistiques des dettes
 *     description: Récupère les statistiques complètes des dettes (totaux, soldes, etc.) - fonctionnalité premium uniquement
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalOwedToMe:
 *                           type: number
 *                         totalIOwe:
 *                           type: number
 *                         paidOwedToMe:
 *                           type: number
 *                         paidIOwe:
 *                           type: number
 *                         unpaidOwedToMe:
 *                           type: number
 *                         unpaidIOwe:
 *                           type: number
 *                         netBalance:
 *                           type: number
 *                         totalDebts:
 *                           type: integer
 *                         paidDebts:
 *                           type: integer
 *                         unpaidDebts:
 *                           type: integer
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/stats", requireAuth, generalRateLimiter, getDebtStatsController);

/**
 * @swagger
 * /debts/{id}:
 *   get:
 *     summary: Récupérer une dette par ID
 *     description: Récupère une dette spécifique par son ID (fonctionnalité premium uniquement)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dette
 *     responses:
 *       200:
 *         description: Dette récupérée avec succès
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
 *                     debt:
 *                       $ref: '#/components/schemas/Debt'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/:id", requireAuth, generalRateLimiter, validate(debtIdSchema), getDebtByIdController);

/**
 * @swagger
 * /debts/{id}:
 *   put:
 *     summary: Mettre à jour une dette
 *     description: Met à jour une dette existante (fonctionnalité premium uniquement)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [OWED_TO_ME, I_OWE]
 *               contactName:
 *                 type: string
 *               amount:
 *                 type: number
 *               isPaid:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dette mise à jour avec succès
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
 *                     debt:
 *                       $ref: '#/components/schemas/Debt'
 *       400:
 *         description: Données invalides
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put("/:id", requireAuth, createResourceRateLimiter, validate(updateDebtSchema), updateDebtController);

/**
 * @swagger
 * /debts/{id}:
 *   delete:
 *     summary: Supprimer une dette
 *     description: Supprime une dette (fonctionnalité premium uniquement)
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dette supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       403:
 *         $ref: '#/components/responses/PremiumRequiredError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete("/:id", requireAuth, generalRateLimiter, validate(debtIdSchema), deleteDebtController);

export default router;

