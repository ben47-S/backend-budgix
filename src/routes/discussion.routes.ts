/**
 * Routes pour les discussions de support client
 * 
 * Routes pour gérer :
 * - La création et récupération des discussions
 * - L'envoi et récupération des messages
 * - Le marquage des messages comme lus
 * - La fermeture des discussions (admin uniquement)
 * 
 * Toutes les routes nécessitent une authentification
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  createDiscussionController,
  getDiscussionController,
  getUserDiscussionsController,
  getAllOpenDiscussionsController,
  sendMessageController,
  markDiscussionAsReadController,
  closeDiscussionController,
} from "../controllers/discussion.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { generalRateLimiter } from "../middleware/rateLimit.js";

const router: Router = ExpressRouter();

// Toutes les routes nécessitent l'authentification
router.use(requireAuth);

/**
 * @swagger
 * /discussions:
 *   post:
 *     summary: Créer une nouvelle discussion
 *     description: Crée une nouvelle discussion de support client pour l'utilisateur authentifié
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Discussion créée avec succès
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
 *                   example: "Discussion créée avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Discussion'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", generalRateLimiter, createDiscussionController);

/**
 * @swagger
 * /discussions:
 *   get:
 *     summary: Récupérer toutes mes discussions
 *     description: Récupère toutes les discussions de l'utilisateur authentifié
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des discussions récupérée avec succès
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
 *                     $ref: '#/components/schemas/Discussion'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", generalRateLimiter, getUserDiscussionsController);

/**
 * @swagger
 * /discussions/open:
 *   get:
 *     summary: Récupérer toutes les discussions ouvertes (admin uniquement)
 *     description: Récupère toutes les discussions ouvertes pour le service client
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des discussions ouvertes récupérée avec succès
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
 *                     $ref: '#/components/schemas/Discussion'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/open", generalRateLimiter, requireAdmin, getAllOpenDiscussionsController);

/**
 * @swagger
 * /discussions/{discussionId}:
 *   get:
 *     summary: Récupérer une discussion par son ID
 *     description: Récupère les détails d'une discussion avec tous ses messages
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discussionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la discussion
 *     responses:
 *       200:
 *         description: Discussion récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Discussion'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       403:
 *         description: Accès refusé à cette discussion
 */
router.get("/:discussionId", generalRateLimiter, getDiscussionController);

/**
 * @swagger
 * /discussions/{discussionId}/messages:
 *   post:
 *     summary: Envoyer un message dans une discussion
 *     description: Envoie un message dans une discussion existante
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discussionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la discussion
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
 *                 maxLength: 5000
 *                 example: "Bonjour, j'ai besoin d'aide avec mon abonnement"
 *     responses:
 *       201:
 *         description: Message envoyé avec succès
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
 *                   example: "Message envoyé avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Contenu du message invalide ou discussion fermée
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:discussionId/messages", generalRateLimiter, sendMessageController);

/**
 * @swagger
 * /discussions/{discussionId}/read:
 *   post:
 *     summary: Marquer une discussion comme lue
 *     description: Marque tous les messages d'une discussion comme lus
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discussionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la discussion
 *     responses:
 *       200:
 *         description: Messages marqués comme lus
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
 *                   example: "Messages marqués comme lus"
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:discussionId/read", generalRateLimiter, markDiscussionAsReadController);

/**
 * @swagger
 * /discussions/{discussionId}/close:
 *   post:
 *     summary: Fermer une discussion (admin uniquement)
 *     description: Ferme une discussion de support client
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: discussionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la discussion
 *     responses:
 *       200:
 *         description: Discussion fermée avec succès
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
 *                   example: "Discussion fermée avec succès"
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:discussionId/close", generalRateLimiter, requireAdmin, closeDiscussionController);

export default router;

