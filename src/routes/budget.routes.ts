/**
 * Routes de gestion des budgets (fonctionnalité avec limitations pour utilisateurs gratuits)
 *
 * NOTE IMPORTANTE: Les vérifications premium se font au niveau SERVICE (budget.service.ts)
 * via la fonction checkBudgetLimit() qui permet:
 * - Utilisateurs gratuits: 1 budget actif par type (MONTHLY ou CUSTOM)
 * - Utilisateurs premium: Budgets illimités
 *
 * Permet de :
 * - Définir des budgets (globaux ou par catégorie) sur une période donnée
 * - Récupérer la progression des budgets pour alimenter les rapports
 * - Supprimer un budget créé précédemment
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import { generalRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validation.js";
import {
  upsertBudgetSchema,
  getBudgetsOverviewSchema,
  deleteBudgetSchema,
  upsertMonthlyBudgetSchema,
  getMonthlyBudgetsSchema,
} from "../validations/budget.validation.js";
import {
  upsertBudgetController,
  getBudgetsOverviewController,
  deleteBudgetController,
  checkBudgetsController,
  upsertMonthlyBudgetController,
  getMonthlyBudgetsController,
  getAllBudgetsController,
} from "../controllers/index.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * tags:
 *   - name: Budgets
 *     description: Gestion des budgets (fonctionnalité premium)
 */

/**
 * @swagger
 * /budgets:
 *   post:
 *     summary: Créer ou mettre à jour un budget
 *     description: |
 *       Crée ou met à jour un budget pour une période donnée.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *
 *       Deux types de budgets :
 *       - Budget global (toutes catégories) : sans categoryId
 *       - Budget par catégorie : avec categoryId
 *     tags: [Budgets]
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
 *               - startDate
 *               - endDate
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 400.00
 *                 description: Montant limite du budget pour la période
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "01-01-2024"
 *                 description: Date de début (jj-mm-yyyy)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "31-01-2024"
 *                 description: Date de fin (jj-mm-yyyy)
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID de la catégorie (optionnel, null = budget global)
 *     responses:
 *       201:
 *         description: Budget créé ou mis à jour avec succès
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
 *                   example: "Budget enregistré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     category:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Trop de requêtes
 */
/**
 * @swagger
 * /budgets:
 *   get:
 *     summary: Récupérer tous les budgets
 *     description: |
 *       Récupère tous les budgets de l'utilisateur (tous types confondus) avec progression et statut.
 *       Permet de filtrer par type et catégorie.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MONTHLY, CUSTOM]
 *         description: Filtrer par type de budget
 *         example: "CUSTOM"
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Filtrer par catégorie (optionnel, null = budget global)
 *         example: "clx1234567890"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Limiter le nombre de résultats
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Décalage pour la pagination
 *         example: 0
 *     responses:
 *       200:
 *         description: Budgets récupérés avec succès
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
 *                     budgets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [MONTHLY, CUSTOM]
 *                           categoryId:
 *                             type: string
 *                             nullable: true
 *                           categoryName:
 *                             type: string
 *                           limitAmount:
 *                             type: number
 *                           spentAmount:
 *                             type: number
 *                           remainingAmount:
 *                             type: number
 *                           progressPercent:
 *                             type: number
 *                           isOverLimit:
 *                             type: boolean
 *                           status:
 *                             type: string
 *                             enum: [DEPASSE, EN_COURS, A_VENIR]
 *                           periodStart:
 *                             type: string
 *                             format: date-time
 *                           periodEnd:
 *                             type: string
 *                             format: date-time
 *                 count:
 *                   type: integer
 *       400:
 *         description: Paramètres invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 */
router.get(
  "/",
  requireAuth,
  generalRateLimiter,
  getAllBudgetsController
);

router.post(
  "/",
  requireAuth,
  generalRateLimiter,
  validate(upsertBudgetSchema),
  upsertBudgetController
);

/**
 * @swagger
 * /budgets/overview:
 *   get:
 *     summary: Progression des budgets pour une période donnée
 *     description: |
 *       Récupère la progression des budgets (dépenses vs limite) pour une période donnée.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *
 *       Cette route est pensée pour alimenter l'écran "Rapports & Aperçus".
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\\d{4}-\\d{2}-\\d{2}$'
 *         required: true
 *         description: Date de début de la période (jj-mm-yyyy)
 *         example: "01-01-2024"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\\d{4}-\\d{2}-\\d{2}$'
 *         required: true
 *         description: Date de fin de la période (jj-mm-yyyy)
 *         example: "31-01-2024"
 *     responses:
 *       200:
 *         description: Progression des budgets récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: object
 *                   properties:
 *                     budgets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           categoryId:
 *                             type: string
 *                             nullable: true
 *                           categoryName:
 *                             type: string
 *                           limitAmount:
 *                             type: number
 *                           spentAmount:
 *                             type: number
 *                           remainingAmount:
 *                             type: number
 *                           progressPercent:
 *                             type: number
 *                             description: Pourcentage de budget consommé (max 100)
 *                           isOverLimit:
 *                             type: boolean
 *                           periodStart:
 *                             type: string
 *                             format: date-time
 *                           periodEnd:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Paramètres de date invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 *       429:
 *         description: Trop de requêtes
 */
router.get(
  "/overview",
  requireAuth,
  generalRateLimiter,
  validate(getBudgetsOverviewSchema),
  getBudgetsOverviewController
);

/**
 * @swagger
 * /budgets/{id}:
 *   delete:
 *     summary: Supprimer un budget
 *     description: |
 *       Supprime un budget créé précédemment.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *
 *       L'utilisateur ne peut supprimer que ses propres budgets.
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du budget à supprimer (format CUID)
 *         example: "clx9876543210"
 *     responses:
 *       200:
 *         description: Budget supprimé avec succès
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
 *                   example: "Budget supprimé avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "clx9876543210"
 *       400:
 *         description: ID du budget invalide ou manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Budget non trouvé ou non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Trop de requêtes
 */
router.delete(
  "/:id",
  requireAuth,
  generalRateLimiter,
  validate(deleteBudgetSchema),
  deleteBudgetController
);

/**
 * @swagger
 * /budgets/check:
 *   post:
 *     summary: Vérifier manuellement tous les budgets actifs
 *     description: |
 *       Déclenche une vérification manuelle de tous les budgets actifs de l'utilisateur.
 *       Si un budget atteint >= 70%, une notification sera programmée.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vérification effectuée avec succès
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
 *                   example: "Vérification des budgets effectuée"
 *                 data:
 *                   type: object
 *                   properties:
 *                     checked:
 *                       type: integer
 *                       example: 3
 *                     budgets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           budgetId:
 *                             type: string
 *                           categoryName:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [checked, error]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 *       429:
 *         description: Trop de requêtes
 */
router.post(
  "/check",
  requireAuth,
  generalRateLimiter,
  checkBudgetsController
);

/**
 * @swagger
 * /budgets/monthly:
 *   post:
 *     summary: Créer ou mettre à jour un budget mensuel
 *     description: |
 *       Crée ou met à jour un budget mensuel pour un mois spécifique.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *     tags: [Budgets]
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
 *               - year
 *               - month
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 400.00
 *                 description: Montant limite du budget pour le mois
 *               year:
 *                 type: number
 *                 example: 2026
 *                 description: "Année (ex: 2026)"
 *               month:
 *                 type: number
 *                 example: 0
 *                 description: Mois (0-11, où 0 = janvier, 11 = décembre)
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID de la catégorie (optionnel, null = budget global)
 *     responses:
 *       201:
 *         description: Budget mensuel créé ou mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 */
router.post(
  "/monthly",
  requireAuth,
  generalRateLimiter,
  validate(upsertMonthlyBudgetSchema),
  upsertMonthlyBudgetController
);

/**
 * @swagger
 * /budgets/monthly:
 *   get:
 *     summary: Récupérer les budgets mensuels
 *     description: |
 *       Récupère les budgets mensuels de l'utilisateur avec progression et statut.
 *       Permet de filtrer par année, mois, et inclure ou non les mois passés.
 *       Fonctionnalité réservée aux utilisateurs premium.
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *         description: Année (optionnel, défaut = année actuelle)
 *         example: 2026
 *       - in: query
 *         name: month
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 11
 *         description: Mois (0-11, où 0 = janvier, optionnel)
 *         example: 0
 *       - in: query
 *         name: includePast
 *         schema:
 *           type: boolean
 *         description: Inclure les mois passés (défaut = false, seulement mois en cours et à venir)
 *         example: true
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Filtrer par catégorie (optionnel, null = budget global)
 *         example: "clx1234567890"
 *     responses:
 *       200:
 *         description: Budgets mensuels récupérés avec succès
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
 *                     budgets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [MONTHLY, CUSTOM]
 *                           categoryId:
 *                             type: string
 *                             nullable: true
 *                           categoryName:
 *                             type: string
 *                           limitAmount:
 *                             type: number
 *                           spentAmount:
 *                             type: number
 *                           remainingAmount:
 *                             type: number
 *                           progressPercent:
 *                             type: number
 *                           isOverLimit:
 *                             type: boolean
 *                           status:
 *                             type: string
 *                             enum: [DEPASSE, EN_COURS, A_VENIR]
 *                           periodStart:
 *                             type: string
 *                             format: date-time
 *                           periodEnd:
 *                             type: string
 *                             format: date-time
 *                           year:
 *                             type: number
 *                           month:
 *                             type: number
 *                 count:
 *                   type: integer
 *       400:
 *         description: Paramètres invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Fonctionnalité premium requise
 */
router.get(
  "/monthly",
  requireAuth,
  generalRateLimiter,
  validate(getMonthlyBudgetsSchema),
  getMonthlyBudgetsController
);

export default router;


