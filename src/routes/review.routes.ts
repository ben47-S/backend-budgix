/**
 * Routes pour les avis utilisateurs
 * 
 * Routes pour gérer :
 * - La création d'avis (note avec étoiles, commentaire optionnel)
 * - La récupération de l'avis de l'utilisateur authentifié
 * - La récupération de tous les avis (admin uniquement)
 * - La mise à jour d'un avis existant
 * - La suppression d'un avis
 * - Les statistiques des avis (admin uniquement)
 * 
 * Note : Les suggestions d'amélioration sont gérées séparément dans /api/improvement-suggestions
 * 
 * Toutes les routes nécessitent une authentification
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createReviewController,
  getUserReviewController,
  getAllReviewsController,
  updateReviewController,
  deleteReviewController,
  getReviewStatsController,
} from "../controllers/review.controller";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { generalRateLimiter } from "../middleware/rateLimit";

const router: Router = ExpressRouter();

// Toutes les routes nécessitent l'authentification
router.use(requireAuth);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Créer un avis
 *     description: Crée un nouvel avis pour l'utilisateur authentifié. Un utilisateur ne peut avoir qu'un seul avis.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Note de 1 à 5 étoiles
 *                 example: 5
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Commentaire optionnel
 *                 example: "Excellente application, très intuitive !"
 *     responses:
 *       201:
 *         description: Avis créé avec succès
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
 *                   example: "Avis créé avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         description: Données invalides ou avis déjà existant
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", generalRateLimiter, createReviewController);

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Récupérer mon avis
 *     description: Récupère l'avis de l'utilisateur authentifié
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avis récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Review'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Aucun avis trouvé pour cet utilisateur
 */
router.get("/", generalRateLimiter, getUserReviewController);

/**
 * @swagger
 * /reviews/all:
 *   get:
 *     summary: Récupérer tous les avis (admin uniquement)
 *     description: Récupère tous les avis de tous les utilisateurs
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des avis récupérée avec succès
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
 *                     $ref: '#/components/schemas/Review'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/all", generalRateLimiter, requireAdmin, getAllReviewsController);

/**
 * @swagger
 * /reviews/stats:
 *   get:
 *     summary: Récupérer les statistiques des avis (admin uniquement)
 *     description: Récupère les statistiques globales des avis (nombre total, moyenne, distribution)
 *     tags: [Reviews]
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
 *                     totalReviews:
 *                       type: integer
 *                       example: 150
 *                     averageRating:
 *                       type: number
 *                       example: 4.5
 *                     ratingDistribution:
 *                       type: object
 *                       properties:
 *                         1:
 *                           type: integer
 *                           example: 5
 *                         2:
 *                           type: integer
 *                           example: 10
 *                         3:
 *                           type: integer
 *                           example: 20
 *                         4:
 *                           type: integer
 *                           example: 50
 *                         5:
 *                           type: integer
 *                           example: 65
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/stats", generalRateLimiter, requireAdmin, getReviewStatsController);

/**
 * @swagger
 * /reviews:
 *   put:
 *     summary: Mettre à jour mon avis
 *     description: Met à jour l'avis de l'utilisateur authentifié
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Note de 1 à 5 étoiles
 *                 example: 4
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Commentaire optionnel
 *                 example: "Très bonne application avec quelques améliorations possibles"
 *     responses:
 *       200:
 *         description: Avis mis à jour avec succès
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
 *                   example: "Avis mis à jour avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         description: Données invalides
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Avis non trouvé
 */
router.put("/", generalRateLimiter, updateReviewController);

/**
 * @swagger
 * /reviews:
 *   delete:
 *     summary: Supprimer mon avis
 *     description: Supprime l'avis de l'utilisateur authentifié
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avis supprimé avec succès
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
 *                   example: "Avis supprimé avec succès"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Avis non trouvé
 */
router.delete("/", generalRateLimiter, deleteReviewController);

export default router;

