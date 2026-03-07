/**
 * Routes de gestion des catégories
 * 
 * Routes pour gérer les catégories :
 * - GET /categories - Liste des catégories (globales + personnalisées)
 * - POST /categories - Créer une catégorie personnalisée
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import {
  getCategoriesController,
  createCategoryController,
} from "../controllers/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { createResourceRateLimiter, generalRateLimiter } from "../middleware/rateLimit.js";
import {
  createCategorySchema,
  getCategoriesSchema,
} from "../validations/category.validation.js";

const router: Router = ExpressRouter();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Liste des catégories
 *     description: Récupère toutes les catégories disponibles (globales + personnalisées de l'utilisateur)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *         description: Filtrer par type de catégorie
 *     responses:
 *       200:
 *         description: Liste des catégories récupérée avec succès
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", requireAuth, generalRateLimiter, validate(getCategoriesSchema), getCategoriesController);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Créer une catégorie personnalisée
 *     description: Crée une nouvelle catégorie personnalisée pour l'utilisateur connecté
 *     tags: [Categories]
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
 *                 description: Nom de la catégorie
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *                 example: "EXPENSE"
 *     responses:
 *       201:
 *         description: Catégorie créée avec succès
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
 *                     category:
 *                       $ref: '#/components/schemas/Category'
 *       400:
 *         description: Données invalides ou catégorie déjà existante
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", requireAuth, createResourceRateLimiter, validate(createCategorySchema), createCategoryController);

export default router;

