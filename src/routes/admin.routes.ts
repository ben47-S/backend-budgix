/**
 * Routes Admin - Gestion des fonctionnalités administrateur
 * 
 * Routes pour gérer :
 * - Les utilisateurs (liste, détails, mise à jour, suppression)
 * - Les statistiques globales
 * - Les catégories globales
 * 
 * Toutes les routes nécessitent une authentification et le rôle ADMIN
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getUsersController,
  getUserDetailsController,
  updateUserController,
  deleteUserController,
  getGlobalStatsController,
  getGlobalCategoriesController,
  createGlobalCategoryController,
  updateGlobalCategoryController,
  deleteGlobalCategoryController,
  sendNotificationToUserController,
  listPendingPaymentsController,
  listPaymentsController,
  approvePaymentController,
  rejectPaymentController,
  getAllExternalSubscriptionsController,
} from "../controllers/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { generalRateLimiter } from "../middleware/rateLimit.js";
import {
  getUsersSchema,
  updateUserSchema,
  createGlobalCategorySchema,
  updateGlobalCategorySchema,
  sendNotificationToUserSchema,
  getAllExternalSubscriptionsSchema,
} from "../validations/admin.validation.js";
import {
  approvePaymentSchema,
  rejectPaymentSchema,
  listPaymentsSchema,
} from "../validations/payment.validation.js";

const router: Router = ExpressRouter();

// Toutes les routes admin nécessitent l'authentification et le rôle ADMIN
router.use(requireAuth, requireAdmin);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Liste des utilisateurs
 *     description: Récupère la liste des utilisateurs avec pagination et filtres (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 20
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par username, email ou phone
 *       - in: query
 *         name: isPremium
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut premium
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN]
 *         description: Filtrer par rôle
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/users", generalRateLimiter, validate(getUsersSchema), getUsersController);

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     summary: Détails d'un utilisateur
 *     description: Récupère les détails complets d'un utilisateur avec ses statistiques (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Détails de l'utilisateur récupérés avec succès
 *       404:
 *         description: Utilisateur non trouvé
 */
router.get("/users/:userId", generalRateLimiter, getUserDetailsController);

/**
 * @swagger
 * /admin/users/{userId}:
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Met à jour le rôle, le statut premium ou le username d'un utilisateur (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *               isPremium:
 *                 type: boolean
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
 *       404:
 *         description: Utilisateur non trouvé
 */
router.put("/users/:userId", generalRateLimiter, validate(updateUserSchema), updateUserController);

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime un utilisateur et toutes ses données associées (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
 *       404:
 *         description: Utilisateur non trouvé
 */
router.delete("/users/:userId", generalRateLimiter, deleteUserController);

/**
 * @swagger
 * /admin/payments:
 *   get:
 *     summary: Liste des paiements avec filtres et pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_VERIFICATION, APPROVED, REJECTED]
 *         description: Filtrer par statut
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par username, email ou phone
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Montant minimum
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Montant maximum
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date de début (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date de fin (ISO format)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Liste des paiements avec pagination
 */
router.get("/payments", generalRateLimiter, validate(listPaymentsSchema), listPaymentsController);

/**
 * @swagger
 * /admin/payments/pending:
 *   get:
 *     summary: Liste des paiements en attente de validation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des paiements en attente
 */
router.get("/payments/pending", generalRateLimiter, listPendingPaymentsController);

/**
 * @swagger
 * /admin/payments/{paymentId}/approve:
 *   post:
 *     summary: Approuver un paiement
 *     description: Approuve un paiement et active l'abonnement premium. L'admin peut choisir le plan à activer ou laisser le plan par défaut du paiement.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du paiement à approuver
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [MONTHLY, ANNUAL]
 *                 description: Plan à activer (optionnel). Si non fourni, utilise le plan du paiement.
 *           examples:
 *             default:
 *               summary: Approuver avec plan par défaut
 *               value: {}
 *             monthly:
 *               summary: Forcer plan mensuel
 *               value:
 *                 plan: "MONTHLY"
 *             annual:
 *               summary: Forcer plan annuel
 *               value:
 *                 plan: "ANNUAL"
 *     responses:
 *       200:
 *         description: Paiement approuvé et abonnement activé
 *       400:
 *         description: Paiement non éligible pour approbation
 *       404:
 *         description: Paiement introuvable
 */
router.post(
  "/payments/:paymentId/approve",
  generalRateLimiter,
  validate(approvePaymentSchema),
  approvePaymentController
);

/**
 * @swagger
 * /admin/payments/{paymentId}/reject:
 *   post:
 *     summary: Rejeter un paiement
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paiement rejeté
 */
router.post(
  "/payments/:paymentId/reject",
  generalRateLimiter,
  validate(rejectPaymentSchema),
  rejectPaymentController
);

/**
 * @swagger
 * /admin/users/{userId}/send-notification:
 *   post:
 *     summary: Envoyer une notification push à un utilisateur
 *     description: Envoie une notification push à un utilisateur spécifique depuis l'admin. La notification est envoyée à tous les tokens push actifs de l'utilisateur, en contournant les préférences de notification (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur destinataire
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Notification importante"
 *                 description: Titre de la notification
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "Ceci est un message de notification depuis l'admin"
 *                 description: Corps de la notification
 *               data:
 *                 type: object
 *                 description: Données supplémentaires (optionnel)
 *                 example: { "type": "admin_notification", "priority": "high" }
 *     responses:
 *       200:
 *         description: Notification envoyée avec succès
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
 *                   example: "Notification envoyée avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokensCount:
 *                       type: integer
 *                       example: 2
 *                       description: Nombre de tokens push utilisés pour l'envoi
 *                     tokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           platform:
 *                             type: string
 *                             enum: [ios, android, web]
 *                           deviceId:
 *                             type: string
 *                             nullable: true
 *       404:
 *         description: Utilisateur non trouvé ou aucun token push actif
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.post(
  "/users/:userId/send-notification",
  generalRateLimiter,
  validate(sendNotificationToUserSchema),
  sendNotificationToUserController
);

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Statistiques globales
 *     description: Récupère les statistiques globales de la plateforme (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques globales récupérées avec succès
 */
router.get("/stats", generalRateLimiter, getGlobalStatsController);

/**
 * @swagger
 * /admin/categories:
 *   get:
 *     summary: Liste des catégories globales
 *     description: Récupère la liste des catégories globales (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des catégories globales récupérée avec succès
 */
router.get("/categories", generalRateLimiter, getGlobalCategoriesController);

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Créer une catégorie globale
 *     description: Crée une nouvelle catégorie globale (admin uniquement)
 *     tags: [Admin]
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Restaurant"
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *                 example: "EXPENSE"
 *     responses:
 *       201:
 *         description: Catégorie globale créée avec succès
 *       409:
 *         description: Une catégorie avec ce nom et ce type existe déjà
 */
router.post("/categories", generalRateLimiter, validate(createGlobalCategorySchema), createGlobalCategoryController);

/**
 * @swagger
 * /admin/categories/{categoryId}:
 *   put:
 *     summary: Mettre à jour une catégorie globale
 *     description: Met à jour une catégorie globale (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la catégorie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *     responses:
 *       200:
 *         description: Catégorie globale mise à jour avec succès
 *       404:
 *         description: Catégorie non trouvée
 *       403:
 *         description: Cette catégorie n'est pas une catégorie globale
 */
router.put("/categories/:categoryId", generalRateLimiter, validate(updateGlobalCategorySchema), updateGlobalCategoryController);

/**
 * @swagger
 * /admin/categories/{categoryId}:
 *   delete:
 *     summary: Supprimer une catégorie globale
 *     description: Supprime une catégorie globale (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la catégorie
 *     responses:
 *       200:
 *         description: Catégorie globale supprimée avec succès
 *       404:
 *         description: Catégorie non trouvée
 *       403:
 *         description: Cette catégorie n'est pas une catégorie globale
 */
router.delete("/categories/:categoryId", generalRateLimiter, deleteGlobalCategoryController);

/**
 * @swagger
 * /admin/external-subscriptions:
 *   get:
 *     summary: Liste de tous les abonnements externes
 *     description: Récupère la liste de tous les abonnements externes de tous les utilisateurs avec pagination et filtres (admin uniquement)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 20
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom d'abonnement ou username
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut actif
 *       - in: query
 *         name: billingCycle
 *         schema:
 *           type: string
 *           enum: [MONTHLY, QUARTERLY, ANNUAL, CUSTOM]
 *         description: Filtrer par cycle de facturation
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Montant minimum
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Montant maximum
 *     responses:
 *       200:
 *         description: Liste des abonnements externes récupérée avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get(
  "/external-subscriptions",
  generalRateLimiter,
  validate(getAllExternalSubscriptionsSchema),
  getAllExternalSubscriptionsController
);

export default router;

