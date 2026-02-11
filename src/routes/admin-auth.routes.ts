/**
 * Routes d'authentification Admin - Connexion admin avec email + mot de passe
 * 
 * Routes pour :
 * - La connexion des administrateurs (email + mot de passe)
 * - La définition du mot de passe pour les administrateurs
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  adminLoginController,
  setAdminPasswordController,
  setAdminPasswordByEmailController,
  verifyAdminTokenController,
} from "../controllers/admin-auth.controller";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { generalRateLimiter } from "../middleware/rateLimit";
import {
  adminLoginSchema,
  setAdminPasswordSchema,
  setAdminPasswordByEmailSchema,
} from "../validations/admin-auth.validation";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /admin/auth/verify:
 *   get:
 *     summary: Vérifier le token admin
 *     description: Vérifie si le token JWT admin est valide et retourne les informations de l'admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isPremium:
 *                       type: boolean
 *                     role:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.get("/verify", requireAuth, requireAdmin, generalRateLimiter, verifyAdminTokenController);

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Connexion administrateur
 *     description: Authentifie un administrateur avec email + mot de passe
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@budgix.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123"
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Connexion réussie
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       401:
 *         description: Email ou mot de passe incorrect
 *       403:
 *         description: Accès refusé - Cette route est réservée aux administrateurs
 */
// Route de login admin avec logging détaillé
router.post("/login", (req, res, next) => {
  console.log("[Admin Auth Route] Requête POST /login reçue");
  console.log("[Admin Auth Route] Body:", req.body);
  console.log("[Admin Auth Route] Headers:", req.headers);
  next();
}, generalRateLimiter, validate(adminLoginSchema), adminLoginController);

/**
 * @swagger
 * /admin/auth/set-password:
 *   post:
 *     summary: Définir son mot de passe admin
 *     description: Définit ou met à jour le mot de passe de l'administrateur connecté
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
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "NewSecurePassword123"
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe défini avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 */
router.post("/set-password", requireAuth, requireAdmin, generalRateLimiter, validate(setAdminPasswordSchema), setAdminPasswordController);

/**
 * @swagger
 * /admin/auth/set-password-by-email:
 *   post:
 *     summary: Définir le mot de passe d'un admin par email
 *     description: Définit ou met à jour le mot de passe d'un administrateur en spécifiant son email (nécessite authentification admin)
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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@budgix.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "NewSecurePassword123"
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe défini avec succès
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Accès refusé - Droits administrateur requis
 *       404:
 *         description: Utilisateur non trouvé
 */
router.post("/set-password-by-email", requireAuth, requireAdmin, generalRateLimiter, validate(setAdminPasswordByEmailSchema), setAdminPasswordByEmailController);

export default router;

