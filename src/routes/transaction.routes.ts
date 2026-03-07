/**
 * Routes de gestion des transactions
 * 
 * Routes pour gérer les transactions :
 * - GET /transactions - Liste des transactions avec filtres
 * - POST /transactions - Créer une transaction
 * - GET /transactions/summary - Résumé des transactions (totaux)
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getTransactionsController,
  createTransactionController,
  getTransactionSummaryController,
  deleteAllTransactionsController,
} from "../controllers/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit.js";
import {
  createTransactionSchema,
  getTransactionsSchema,
  getTransactionSummarySchema,
  deleteAllTransactionsSchema,
} from "../validations/transaction.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Liste des transactions
 *     description: Récupère les transactions de l'utilisateur avec filtres optionnels (période, catégorie, pagination)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *         description: Filtrer par période
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filtrer par ID de catégorie
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Nombre maximum de transactions à retourner
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Nombre de transactions à ignorer (pagination)
 *     responses:
 *       200:
 *         description: Liste des transactions récupérée avec succès
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, validate(getTransactionsSchema), getTransactionsController);

/**
 * @swagger
 * /transactions/summary:
 *   get:
 *     summary: Résumé des transactions
 *     description: Récupère le résumé des transactions (totaux dépenses/revenus/différence) pour une période donnée
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *         description: Période pour le résumé
 *     responses:
 *       200:
 *         description: Résumé récupéré avec succès
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalIncome:
 *                           type: number
 *                           example: 5000.00
 *                         totalExpenses:
 *                           type: number
 *                           example: 3200.00
 *                         difference:
 *                           type: number
 *                           example: 1800.00
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/summary", requireAuth, generalRateLimiter, validate(getTransactionSummarySchema), getTransactionSummaryController);

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Créer une transaction
 *     description: Crée une nouvelle transaction (revenu ou dépense) pour l'utilisateur connecté
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - categoryId
 *               - date
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50.00
 *                 description: Montant de la transaction (positif)
 *               categoryId:
 *                 type: string
 *                 example: "clx1234567890"
 *                 description: ID de la catégorie
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-18T12:00:00.000Z"
 *                 description: Date de la transaction (jour du mois en cours)
 *               time:
 *                 type: string
 *                 example: "14:30"
 *                 description: Heure optionnelle (format HH:mm)
 *               note:
 *                 type: string
 *                 example: "Achat au supermarché"
 *                 description: Note optionnelle
 *     responses:
 *       201:
 *         description: Transaction créée avec succès
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
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Données invalides (montant négatif, catégorie inexistante, etc.)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", requireAuth, createResourceRateLimiter, validate(createTransactionSchema), createTransactionController);

/**
 * @swagger
 * /transactions/all:
 *   delete:
 *     summary: Supprimer toutes les transactions
 *     description: |
 *       Supprime toutes les transactions de l'utilisateur connecté.
 *       ⚠️ ATTENTION : Cette opération est irréversible !
 *       
 *       Une confirmation explicite est requise dans le body : { confirm: true }
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 example: true
 *                 description: Confirmation requise pour supprimer toutes les transactions
 *     responses:
 *       200:
 *         description: Toutes les transactions supprimées avec succès
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
 *                   example: "50 transaction(s) supprimée(s) avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 50
 *       400:
 *         description: Confirmation manquante ou invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "CONFIRMATION_REQUIRED"
 *                     message:
 *                       type: string
 *                       example: "Confirmation requise. Vous devez confirmer la suppression en envoyant { confirm: true }"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete(
  "/all",
  requireAuth,
  createResourceRateLimiter,
  validate(deleteAllTransactionsSchema),
  deleteAllTransactionsController
);

export default router;

