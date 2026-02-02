/**
 * Routes d'authentification
 * 
 * Routes pour gérer l'authentification par OTP :
 * - POST /auth/otp/send - Envoyer un code OTP
 * - POST /auth/otp/verify - Vérifier un code OTP
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import { sendOTP, verifyOTPController, logoutController } from "../controllers";
import { validate } from "../middleware/validation";
import { authRateLimiter, generalRateLimiter } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/auth";
import {
  sendOTPSchema,
  verifyOTPSchema,
  googleTestSchema,
} from "../validations/auth.validation";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Envoyer un code OTP
 *     description: Envoie un code OTP à 6 chiffres à un numéro de téléphone. Le code est valide pendant 5 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+2250123456789"
 *                 description: Numéro de téléphone au format international (+225 suivi de 10 chiffres)
 *     responses:
 *       200:
 *         description: Code OTP envoyé avec succès
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
 *                   example: "Code OTP envoyé avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                       example: "+2250123456789"
 *                     code:
 *                       type: string
 *                       example: "123456"
 *                       description: Code OTP (uniquement en développement)
 *       400:
 *         description: Numéro de téléphone invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 message: "Numéro de téléphone invalide"
 *                 code: "INVALID_PHONE"
 */
router.post("/otp/send", authRateLimiter, validate(sendOTPSchema), sendOTP);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Vérifier un code OTP et s'authentifier
 *     description: Vérifie le code OTP et authentifie l'utilisateur. Crée un nouvel utilisateur si c'est la première connexion, sinon connecte l'utilisateur existant.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+2250123456789"
 *               code:
 *                 type: string
 *                 example: "123456"
 *                 description: Code OTP à 6 chiffres
 *     responses:
 *       200:
 *         description: Authentification réussie
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
 *                   example: "Inscription réussie"
 *                   description: "Message indiquant si c'est une inscription ou une connexion"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     isNewUser:
 *                       type: boolean
 *                       example: true
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       description: Token JWT pour l'authentification
 *       400:
 *         description: Code OTP invalide, expiré ou déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 message: "Code OTP invalide, expiré ou déjà utilisé"
 *                 code: "INVALID_OTP"
 */
router.post("/otp/verify", authRateLimiter, validate(verifyOTPSchema), verifyOTPController);

// Routes OAuth
import {
  googleCallbackController,
  googleTestController,
} from "../controllers";

/**
 * @swagger
 * /auth/oauth/google/callback:
 *   get:
 *     summary: Callback Google OAuth
 *     description: Callback appelé par Google après authentification OAuth. Redirige vers le frontend avec le token JWT.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentification Google réussie
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
 *                   example: "Inscription Google réussie"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *       401:
 *         description: Erreur d'authentification Google
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/oauth/google/callback", googleCallbackController);

/**
 * @swagger
 * /auth/oauth/google/test:
 *   post:
 *     summary: Test OAuth Google (développement uniquement)
 *     description: Route de test pour simuler l'authentification Google sans configuration OAuth complète. À utiliser uniquement en développement.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               displayName:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: Authentification test réussie
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
 *                     isNewUser:
 *                       type: boolean
 */
router.post("/oauth/google/test", validate(googleTestSchema), googleTestController);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnexion de l'utilisateur
 *     description: Déconnecte l'utilisateur. Avec JWT stateless, la déconnexion se fait principalement côté client en supprimant le token. Cette route confirme la déconnexion.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie. Le frontend doit rediriger vers la page de connexion.
 *         headers:
 *           X-Redirect-To-Login:
 *             description: Header indiquant qu'une redirection vers la page de connexion est nécessaire
 *             schema:
 *               type: string
 *               example: "true"
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
 *                   example: "Déconnexion réussie"
 *                 redirectToLogin:
 *                   type: boolean
 *                   example: true
 *                   description: Flag indiquant qu'une redirection vers la page de connexion est nécessaire
 *       401:
 *         description: Non authentifié. Le frontend doit rediriger vers la page de connexion.
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
 *                     message:
 *                       type: string
 *                       example: "Erreur d'authentification"
 *                 redirectToLogin:
 *                   type: boolean
 *                   example: true
 *                   description: Flag indiquant qu'une redirection vers la page de connexion est nécessaire
 */
router.post("/logout", requireAuth, generalRateLimiter, logoutController);

export default router;

