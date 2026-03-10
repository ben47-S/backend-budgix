/**
 * Point d'entrée principal de l'application
 * 
 * Ce fichier initialise le serveur Express et configure
 * tous les middlewares et routes de l'application.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import apiRoutes from "./routes/index.js";
import { swaggerSpec } from "./config/swagger.js";
import logger from "./lib/logger.js";
import { startCronJobs } from "./lib/cron.js";
import { initWebSocket } from "./services/websocket.service.js";
import { configurePassport } from "./config/passport.js";

// Créer l'application Express
const app = express();

// Configurer Passport (stratégies, etc.)
configurePassport(passport);

// Configuration __dirname pour ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer le serveur HTTP pour WebSocket
const httpServer = createServer(app);

// Configuration du port
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES GLOBAUX
// ============================================

// Logger des requêtes HTTP (doit être en premier pour capturer toutes les requêtes)
app.use(requestLogger);

// CORS - Autoriser les requêtes depuis le frontend
// Support de plusieurs origines pour le développement
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "https://admin-budgix.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origine (Postman, curl, etc.) en développement
      if (!origin && process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      
      // Vérifier si l'origine est autorisée
      if (origin && allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (!origin) {
        // Autoriser les requêtes sans origine
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true, // Autoriser les cookies/credentials
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parser JSON - Analyser les corps de requête JSON
app.use(express.json());

// Middleware de debug pour voir toutes les requêtes POST
app.use((req, res, next) => {
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    logger.info(`[DEBUG] ${req.method} ${req.path}`, {
      body: req.body,
      headers: req.headers,
    });
  }
  next();
});

// Parser URL-encoded - Analyser les données de formulaire
app.use(express.urlencoded({ extended: true }));

// Initialiser Passport (sans gestion de session, JWT uniquement)
app.use(passport.initialize());

// ============================================
// ROUTES
// ============================================

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Vérifie que le serveur et la base de données sont opérationnels
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: simple
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Si true, effectue un check simple sans vérifier la base de données
 *     responses:
 *       200:
 *         description: Serveur opérationnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                   example: "healthy"
 *                 message:
 *                   type: string
 *                   example: "Tous les services sont opérationnels"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [ok, error]
 *                         message:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                           description: Temps de réponse en millisecondes
 *       503:
 *         description: Service indisponible (base de données inaccessible)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 message:
 *                   type: string
 *                   example: "Un ou plusieurs services rencontrent des problèmes"
 */
app.get("/health", async (req, res) => {
  try {
    // Si le paramètre simple=true, on fait un check rapide sans DB
    const simple = req.query.simple === "true";
    
    if (simple) {
      const { simpleHealthCheck } = await import("./utils/health.js");
      const result = simpleHealthCheck();
      return res.json(result);
    }
    
    // Sinon, on fait un check complet avec vérification de la DB
    const { performHealthCheck } = await import("./utils/health.js");
    const result = await performHealthCheck();
    
    // Retourner 503 si unhealthy, sinon 200
    const statusCode = result.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error: any) {
    // En cas d'erreur, retourner un statut unhealthy
    res.status(503).json({
      status: "unhealthy",
      message: `Erreur lors du health check: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * @swagger
 * /api:
 *   get:
 *     summary: Informations API
 *     description: Retourne les informations de base sur l'API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Informations API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 version:
 *                   type: string
 */
app.get("/api", (req, res) => {
  res.json({
    message: "API Budgix - Gestion de budget",
    version: "1.0.0",
  });
});

// Documentation Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Budgix API Documentation",
}));

// Route pour obtenir le JSON Swagger
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ============================================
// PAGES LÉGALES (HTML)
// ============================================

/**
 * @swagger
 * /legal/privacy:
 *   get:
 *     summary: Politique de confidentialité
 *     description: Affiche la page de politique de confidentialité
 *     tags: [Legal]
 *     responses:
 *       200:
 *         description: Page HTML de la politique de confidentialité
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get("/legal/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "legal", "privacy.html"));
});

/**
 * @swagger
 * /legal/terms:
 *   get:
 *     summary: Conditions générales d'utilisation
 *     description: Affiche la page des conditions générales
 *     tags: [Legal]
 *     responses:
 *       200:
 *         description: Page HTML des conditions générales
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get("/legal/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "legal", "terms.html"));
});

/**
 * @swagger
 * /legal/subscription:
 *   get:
 *     summary: Informations sur les abonnements
 *     description: Affiche la page d'informations sur les abonnements
 *     tags: [Legal]
 *     responses:
 *       200:
 *         description: Page HTML des informations d'abonnement
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get("/legal/subscription", (req, res) => {
  res.sendFile(path.join(__dirname, "legal", "subscription.html"));
});

// Routes API
app.use("/api", apiRoutes);

// ============================================
// GESTION DES ERREURS
// ============================================

// Route 404 - Route non trouvée
app.use(notFoundHandler);

// Gestionnaire d'erreurs global
app.use(errorHandler);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================


httpServer.listen(PORT , () => {
  logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`📍 API: http://localhost:${PORT}/api`);
  logger.info(`📚 Documentation Swagger: http://localhost:${PORT}/api-docs`);
  logger.info(`📜 Pages légales: http://localhost:${PORT}/legal/privacy | /legal/terms | /legal/subscription`);
  logger.info(`🌍 Environnement: ${process.env.NODE_ENV || "development"}`);
  
  // Initialiser WebSocket
  initWebSocket(httpServer);
  logger.info("🔌 WebSocket initialisé");
  
  // Démarrer les tâches cron (uniquement en production ou si activé)
  if (process.env.ENABLE_CRON !== "false") {
    startCronJobs();
  } else {
    logger.info("⏰ Tâches cron désactivées (ENABLE_CRON=false)");
  }
});

// Gestion propre de l'arrêt du serveur
process.on("SIGTERM", () => {
  logger.info("SIGTERM reçu, arrêt du serveur...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT reçu, arrêt du serveur...");
  process.exit(0);
});

