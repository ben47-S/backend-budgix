/**
 * Routes de test - Pour déboguer les problèmes de connexion et tester l'API LeTexto
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  testSendSMS,
  testSendOTP,
  testGetBalance,
  testCheckSMSStatus,
  testSendEmail,
  testEmailConnection,
} from "../controllers/test.controller.js";
import { validate } from "../middleware/validation.js";
import { testSendSMSSchema, testSendOTPSchema } from "../validations/test.validation.js";

const router: Router = ExpressRouter();

// Middleware de protection - Routes accessibles uniquement en développement
router.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({
      success: false,
      error: {
        message: "Les routes de test sont uniquement disponibles en développement",
        code: "FORBIDDEN",
      },
    });
  }
  return next();
});

/**
 * Route de test simple pour vérifier que le backend répond
 */
router.get("/test", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Backend fonctionne correctement",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Route de test pour vérifier que POST fonctionne
 */
router.post("/test", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "POST fonctionne correctement",
    receivedData: req.body,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /test/sms/send:
 *   post:
 *     summary: Envoyer un SMS de test personnalisé (DEV uniquement)
 *     description: Envoie un SMS avec un message personnalisé via l'API LeTexto. Disponible uniquement en mode développement.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - message
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+2250123456789"
 *                 description: Numéro de téléphone au format international
 *               message:
 *                 type: string
 *                 example: "Test SMS depuis Budgix"
 *                 description: Message à envoyer (max 160 caractères)
 *     responses:
 *       200:
 *         description: SMS envoyé avec succès
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
 *                   example: "SMS de test envoyé avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     messageLength:
 *                       type: number
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.post("/sms/send", validate(testSendSMSSchema), testSendSMS);

/**
 * @swagger
 * /test/sms/otp:
 *   post:
 *     summary: Envoyer un code OTP de test (DEV uniquement)
 *     description: Génère et envoie un code OTP de test via SMS. Le code est retourné dans la réponse. Disponible uniquement en mode développement.
 *     tags: [Test]
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
 *                 description: Numéro de téléphone au format international
 *     responses:
 *       200:
 *         description: OTP envoyé avec succès
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
 *                   example: "OTP de test envoyé avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     code:
 *                       type: string
 *                       description: Code OTP à 6 chiffres
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.post("/sms/otp", validate(testSendOTPSchema), testSendOTP);

/**
 * @swagger
 * /test/sms/balance:
 *   get:
 *     summary: Vérifier le solde LeTexto (DEV uniquement)
 *     description: Récupère le solde de crédits SMS du compte LeTexto. Disponible uniquement en mode développement.
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Solde récupéré avec succès
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
 *                   example: "Solde récupéré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       example: 1000
 *                     currency:
 *                       type: string
 *                       example: "SMS credits"
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.get("/sms/balance", testGetBalance);

/**
 * @swagger
 * /test/sms/status/{messageId}:
 *   get:
 *     summary: Vérifier le statut d'un message SMS (DEV uniquement)
 *     description: Récupère le statut de livraison d'un message envoyé via LeTexto. Disponible uniquement en mode développement.
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du message retourné lors de l'envoi
 *     responses:
 *       200:
 *         description: Statut récupéré avec succès
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
 *                   example: "Statut du message récupéré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "delivered"
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.get("/sms/status/:messageId", testCheckSMSStatus);

/**
 * @swagger
 * /test/email/send:
 *   post:
 *     summary: Envoyer un email de vérification de test (DEV uniquement)
 *     description: Envoie un email avec un code de vérification. Disponible uniquement en mode développement.
 *     tags: [Test]
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
 *                 example: "test@example.com"
 *                 description: Adresse email du destinataire
 *     responses:
 *       200:
 *         description: Email envoyé avec succès
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
 *                   example: "Email de vérification envoyé avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     code:
 *                       type: string
 *                       description: Code de vérification à 6 chiffres
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.post("/email/send", testSendEmail);

/**
 * @swagger
 * /test/email/verify-connection:
 *   get:
 *     summary: Vérifier la connexion SMTP (DEV uniquement)
 *     description: Teste la connexion au serveur SMTP configuré. Disponible uniquement en mode développement.
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Connexion SMTP vérifiée avec succès
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
 *                   example: "Connexion SMTP vérifiée avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     host:
 *                       type: string
 *                       example: "smtp.gmail.com"
 *                     port:
 *                       type: number
 *                       example: 587
 *                     user:
 *                       type: string
 *                       example: "noreply@budgix.com"
 *       403:
 *         description: Routes de test non disponibles en production
 */
router.get("/email/verify-connection", testEmailConnection);

export default router;

