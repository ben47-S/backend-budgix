/**
 * Routes de gestion des statistiques
 * 
 * Routes pour gérer les statistiques :
 * - GET /stats - Statistiques complètes depuis l'inscription
 * - GET /stats/totals - Totaux depuis l'inscription
 * - GET /stats/top-categories - Top catégories de dépenses (top 3 si premium, top 2 sinon)
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getStatsController,
  getTotalsController,
  getTopCategoriesController,
  getPremiumStatsController,
} from "../controllers/index.js";
import { requireAuth, requirePremium } from "../middleware/auth.js";
import { generalRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validation.js";
import { getPremiumStatsSchema } from "../validations/stats.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Statistiques complètes
 *     description: |
 *       Récupère toutes les statistiques depuis l'inscription.
 *       Les catégories sont classées par montant total (pourcentage), pas par nombre de transactions.
 *       - Utilisateurs premium : totaux + top 3 catégories de dépenses + top 3 catégories de revenus
 *       - Utilisateurs non premium : totaux + top 2 catégories de dépenses
 *     tags: [Statistics]
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
 *                     totals:
 *                       type: object
 *                       properties:
 *                         totalIncome:
 *                           type: number
 *                         totalExpense:
 *                           type: number
 *                         difference:
 *                           type: number
 *                         transactionCount:
 *                           type: integer
 *                     topExpenseCategories:
 *                       type: array
 *                       description: Top catégories de dépenses classées par montant total (top 3 si premium, top 2 sinon)
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             description: Nom de la catégorie
 *                           transactionCount:
 *                             type: integer
 *                             description: Nombre de transactions dans cette catégorie
 *                           totalAmount:
 *                             type: number
 *                             description: Montant total dépensé dans cette catégorie
 *                           percentage:
 *                             type: number
 *                             description: Pourcentage du total des dépenses représenté par cette catégorie
 *                             example: 35.5
 *                     topIncomeCategories:
 *                       type: array
 *                       description: Top 3 catégories de revenus classées par montant total (premium uniquement)
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             description: Nom de la catégorie
 *                           transactionCount:
 *                             type: integer
 *                             description: Nombre de transactions dans cette catégorie
 *                           totalAmount:
 *                             type: number
 *                             description: Montant total gagné dans cette catégorie
 *                           percentage:
 *                             type: number
 *                             description: Pourcentage du total des revenus représenté par cette catégorie
 *                             example: 65.2
 *                     userSince:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, getStatsController);

/**
 * @swagger
 * /stats/totals:
 *   get:
 *     summary: Totaux depuis l'inscription
 *     description: Récupère uniquement les totaux (revenus, dépenses, différence) depuis l'inscription
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Totaux récupérés avec succès
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
 *                     totals:
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
router.get("/totals", requireAuth, generalRateLimiter, getTotalsController);

/**
 * @swagger
 * /stats/top-categories:
 *   get:
 *     summary: Top catégories de dépenses
 *     description: |
 *       Récupère les catégories de dépenses classées par montant total (pourcentage) depuis l'inscription.
 *       Les catégories sont triées par montant total dépensé, pas par nombre de transactions.
 *       - Utilisateurs premium : top 3 catégories
 *       - Utilisateurs non premium : top 2 catégories
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Top catégories récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   maxItems: 3
 *                   items:
 *                         type: object
 *                         properties:
 *                           categoryId:
 *                             type: string
 *                           categoryName:
 *                             type: string
 *                           count:
 *                             type: integer
 *                             description: Nombre de transactions
 *                           totalAmount:
 *                             type: number
 *                             description: Montant total
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/top-categories", requireAuth, generalRateLimiter, getTopCategoriesController);

/**
 * @swagger
 * /stats/premium:
 *   get:
 *     summary: Statistiques premium pour une période spécifique
 *     description: |
 *       Récupère les statistiques (totaux + top 3 catégories de dépenses + top 3 catégories de revenus) pour une période spécifique.
 *       Les catégories sont classées par montant total (pourcentage) de la période, pas par nombre de transactions.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *       
 *       Trois modes d'utilisation :
 *       1. Période personnalisée : startDate + endDate (format jj-mm-yyyy)
 *       2. Période relative : date (jj-mm-yyyy) + period (day|week|month|year)
 *       3. Jour spécifique : date seul (jj-mm-yyyy)
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date de début (format jj-mm-yyyy). Doit être fournie avec endDate.
 *         example: "01-01-2024"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date de fin (format jj-mm-yyyy). Doit être fournie avec startDate.
 *         example: "31-01-2024"
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date de référence (format jj-mm-yyyy). Peut être utilisée seule (jour) ou avec period.
 *         example: "15-01-2024"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: Période relative à la date de référence. Doit être fournie avec date.
 *         example: "month"
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totals:
 *                       type: object
 *                       properties:
 *                         totalIncome:
 *                           type: number
 *                           example: 5000.00
 *                         totalExpense:
 *                           type: number
 *                           example: 3200.00
 *                         difference:
 *                           type: number
 *                           example: 1800.00
 *                         transactionCount:
 *                           type: integer
 *                           example: 45
 *                     topExpenseCategories:
 *                       type: array
 *                       maxItems: 3
 *                       description: Top 3 catégories de dépenses classées par montant total
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Alimentation"
 *                             description: Nom de la catégorie
 *                           transactionCount:
 *                             type: integer
 *                             example: 15
 *                             description: Nombre de transactions dans cette catégorie
 *                           totalAmount:
 *                             type: number
 *                             example: 1200.00
 *                             description: Montant total dépensé dans cette catégorie
 *                           percentage:
 *                             type: number
 *                             example: 35.5
 *                             description: Pourcentage du total des dépenses de la période représenté par cette catégorie
 *                     topIncomeCategories:
 *                       type: array
 *                       maxItems: 3
 *                       description: Top 3 catégories de revenus classées par montant total
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Salaire"
 *                             description: Nom de la catégorie
 *                           transactionCount:
 *                             type: integer
 *                             example: 12
 *                             description: Nombre de transactions dans cette catégorie
 *                           totalAmount:
 *                             type: number
 *                             example: 5000.00
 *                             description: Montant total gagné dans cette catégorie
 *                           percentage:
 *                             type: number
 *                             example: 65.2
 *                             description: Pourcentage du total des revenus de la période représenté par cette catégorie
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-31T23:59:59.999Z"
 *       400:
 *         description: Paramètres de date invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 message: "Vous devez fournir soit (startDate + endDate), soit (date + period), soit (date seul)"
 *                 code: "INVALID_DATE_PARAMS"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 message: "Fonctionnalité premium - Abonnement requis"
 *                 code: "PREMIUM_REQUIRED"
 */
router.get(
  "/premium",
  requireAuth,
  requirePremium,
  generalRateLimiter,
  validate(getPremiumStatsSchema),
  getPremiumStatsController
);

export default router;

