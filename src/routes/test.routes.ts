/**
 * Routes de test - Pour déboguer les problèmes de connexion
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";
import type { Request, Response } from "express";

const router: Router = ExpressRouter();

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

export default router;

