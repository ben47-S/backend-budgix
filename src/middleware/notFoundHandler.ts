/**
 * Middleware pour gérer les routes non trouvées (404)
 * 
 * Ce middleware doit être placé après toutes les routes
 * mais avant le gestionnaire d'erreurs global.
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Middleware pour les routes non trouvées
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route non trouvée : ${req.method} ${req.originalUrl}`,
    },
  });
}

