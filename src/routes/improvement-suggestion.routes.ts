/**
 * Routes pour les suggestions d'amélioration
 * 
 * Routes pour gérer :
 * - La création de suggestions d'amélioration (plusieurs par utilisateur)
 * - La récupération des suggestions de l'utilisateur authentifié
 * - La récupération de toutes les suggestions (admin uniquement)
 * - La récupération d'une suggestion par son ID
 * - La mise à jour d'une suggestion existante
 * - La suppression d'une suggestion
 * - Les statistiques des suggestions (admin uniquement)
 * 
 * Toutes les routes nécessitent une authentification
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createImprovementSuggestionController,
  getUserImprovementSuggestionsController,
  getAllImprovementSuggestionsController,
  getImprovementSuggestionByIdController,
  updateImprovementSuggestionController,
  deleteImprovementSuggestionController,
  getImprovementSuggestionStatsController,
} from "../controllers/improvement-suggestion.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { generalRateLimiter } from "../middleware/rateLimit.js";

const router: Router = ExpressRouter();

// Toutes les routes nécessitent l'authentification
router.use(requireAuth);

/**
 * @swagger
 * /improvement-suggestions:
 *   post:
 *     summary: Créer une suggestion d'amélioration
 *     description: Crée une nouvelle suggestion d'amélioration pour l'utilisateur authentifié. Un utilisateur peut avoir plusieurs suggestions.
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: Contenu de la suggestion d'amélioration
 *                 example: "Il serait bien d'ajouter une fonctionnalité de graphiques"
 *     responses:
 *       201:
 *         description: Suggestion créée avec succès
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
 *                   example: "Suggestion d'amélioration créée avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/ImprovementSuggestion'
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", generalRateLimiter, createImprovementSuggestionController);

/**
 * @swagger
 * /improvement-suggestions:
 *   get:
 *     summary: Récupérer mes suggestions d'amélioration
 *     description: Récupère toutes les suggestions d'amélioration de l'utilisateur authentifié
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des suggestions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImprovementSuggestion'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", generalRateLimiter, getUserImprovementSuggestionsController);

/**
 * @swagger
 * /improvement-suggestions/all:
 *   get:
 *     summary: Récupérer toutes les suggestions (admin uniquement)
 *     description: Récupère toutes les suggestions d'amélioration de tous les utilisateurs
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des suggestions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImprovementSuggestion'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/all", generalRateLimiter, requireAdmin, getAllImprovementSuggestionsController);

/**
 * @swagger
 * /improvement-suggestions/stats:
 *   get:
 *     summary: Récupérer les statistiques des suggestions (admin uniquement)
 *     description: Récupère les statistiques globales des suggestions
 *     tags: [Improvement Suggestions]
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSuggestions:
 *                       type: integer
 *                       example: 150
 *                     uniqueUsers:
 *                       type: integer
 *                       example: 50
 *                     averagePerUser:
 *                       type: number
 *                       example: 3.0
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/stats", generalRateLimiter, requireAdmin, getImprovementSuggestionStatsController);

/**
 * @swagger
 * /improvement-suggestions/{suggestionId}:
 *   get:
 *     summary: Récupérer une suggestion par son ID
 *     description: Récupère les détails d'une suggestion d'amélioration
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: suggestionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la suggestion
 *     responses:
 *       200:
 *         description: Suggestion récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ImprovementSuggestion'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       403:
 *         description: Accès refusé à cette suggestion
 */
router.get("/:suggestionId", generalRateLimiter, getImprovementSuggestionByIdController);

/**
 * @swagger
 * /improvement-suggestions/{suggestionId}:
 *   put:
 *     summary: Mettre à jour une suggestion
 *     description: Met à jour une suggestion d'amélioration existante
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: suggestionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la suggestion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: Contenu de la suggestion d'amélioration
 *                 example: "Ajouter plus de graphiques"
 *     responses:
 *       200:
 *         description: Suggestion mise à jour avec succès
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
 *                   example: "Suggestion mise à jour avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/ImprovementSuggestion'
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Suggestion non trouvée
 */
router.put("/:suggestionId", generalRateLimiter, updateImprovementSuggestionController);

/**
 * @swagger
 * /improvement-suggestions/{suggestionId}:
 *   delete:
 *     summary: Supprimer une suggestion
 *     description: Supprime une suggestion d'amélioration
 *     tags: [Improvement Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: suggestionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la suggestion
 *     responses:
 *       200:
 *         description: Suggestion supprimée avec succès
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
 *                   example: "Suggestion supprimée avec succès"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Suggestion non trouvée
 */
router.delete("/:suggestionId", generalRateLimiter, deleteImprovementSuggestionController);

export default router;

