/**
 * Routes de gestion du profil utilisateur
 * 
 * Routes pour gérer le profil utilisateur :
 * - GET /profile - Récupérer le profil de l'utilisateur connecté
 * - POST /profile/phone/send - Envoyer un code OTP pour ajouter/mettre à jour le téléphone
 * - POST /profile/phone/verify - Vérifier le code OTP et mettre à jour le téléphone
 * - POST /profile/email/send - Envoyer un code de vérification pour ajouter/mettre à jour l'email
 * - POST /profile/email/verify - Vérifier le code et mettre à jour l'email
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getProfile,
  updateProfile,
  sendPhoneOTP,
  verifyPhoneOTP,
  sendEmailVerification,
  verifyEmailCode,
} from "../controllers/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { profileRateLimiter, generalRateLimiter, createResourceRateLimiter } from "../middleware/rateLimit.js";
import {
  addPhoneSchema,
  verifyPhoneSchema,
  addEmailSchema,
  verifyEmailSchema,
  updateUsernameSchema,
} from "../validations/profile.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Récupérer le profil utilisateur
 *     description: Récupère les informations du profil de l'utilisateur connecté
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil récupéré avec succès
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   put:
 *     summary: Mettre à jour le nom d'utilisateur
 *     description: Met à jour le nom d'utilisateur (username) de l'utilisateur connecté. Si le username n'existe pas, il sera créé.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 example: "john_doe"
 *                 description: Nom d'utilisateur (3-30 caractères, lettres, chiffres et underscores uniquement)
 *     responses:
 *       200:
 *         description: Nom d'utilisateur mis à jour avec succès
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
 *                       description: Nouveau token JWT avec les informations mises à jour
 *       400:
 *         description: Nom d'utilisateur invalide
 *       409:
 *         description: Nom d'utilisateur déjà utilisé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, getProfile);
router.put("/", requireAuth, createResourceRateLimiter, validate(updateUsernameSchema), updateProfile);

/**
 * @swagger
 * /profile/phone/send:
 *   post:
 *     summary: Envoyer un code OTP pour ajouter/mettre à jour le téléphone
 *     description: Envoie un code OTP pour ajouter ou mettre à jour le numéro de téléphone de l'utilisateur connecté
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Code OTP envoyé avec succès
 *       400:
 *         description: Numéro de téléphone invalide ou déjà associé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/phone/send", requireAuth, profileRateLimiter, validate(addPhoneSchema), sendPhoneOTP);

/**
 * @swagger
 * /profile/phone/verify:
 *   post:
 *     summary: Vérifier le code OTP et mettre à jour le téléphone
 *     description: Vérifie le code OTP et met à jour le numéro de téléphone de l'utilisateur. Retourne un nouveau token JWT.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Téléphone mis à jour avec succès
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
 *                       description: Nouveau token JWT avec les informations mises à jour
 *       400:
 *         description: Code OTP invalide ou numéro déjà utilisé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/phone/verify", requireAuth, profileRateLimiter, validate(verifyPhoneSchema), verifyPhoneOTP);

/**
 * @swagger
 * /profile/email/send:
 *   post:
 *     summary: Envoyer un code de vérification pour ajouter/mettre à jour l'email
 *     description: Envoie un code de vérification à 6 chiffres pour ajouter ou mettre à jour l'email de l'utilisateur connecté
 *     tags: [Profile]
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Code de vérification envoyé avec succès
 *       400:
 *         description: Format d'email invalide ou déjà associé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/email/send", requireAuth, profileRateLimiter, validate(addEmailSchema), sendEmailVerification);

/**
 * @swagger
 * /profile/email/verify:
 *   post:
 *     summary: Vérifier le code et mettre à jour l'email
 *     description: Vérifie le code de vérification et met à jour l'email de l'utilisateur. Retourne un nouveau token JWT.
 *     tags: [Profile]
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
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email mis à jour avec succès
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
 *       400:
 *         description: Code de vérification invalide ou email déjà utilisé
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/email/verify", requireAuth, profileRateLimiter, validate(verifyEmailSchema), verifyEmailCode);

export default router;

