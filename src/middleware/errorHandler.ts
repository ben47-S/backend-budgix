/**
 * Middleware de gestion des erreurs global
 * 
 * Ce middleware capture toutes les erreurs non gérées
 * et renvoie une réponse JSON standardisée.
 */

import type { Request, Response, NextFunction } from "express";
import logger from "../lib/logger.js";

// Interface pour les erreurs personnalisées
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Middleware de gestion des erreurs
 * Doit être placé en dernier dans la chaîne de middlewares
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log de l'erreur avec Winston
  logger.error("Erreur HTTP", {
    message: err.message,
    statusCode: err.statusCode || 500,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Déterminer le code de statut HTTP
  const statusCode = err.statusCode || 500;

  // Message d'erreur
  const message =
    err.message || "Une erreur interne du serveur s'est produite";

  // Réponse d'erreur standardisée
  const response: any = {
    success: false,
    error: {
      message,
      code: err.code,
      // Inclure les erreurs de validation détaillées si disponibles
      ...((err as any).validationErrors && {
        validationErrors: (err as any).validationErrors,
      }),
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
      }),
    },
  };

  // Ajouter un flag de redirection pour les erreurs d'authentification (401)
  if (statusCode === 401) {
    response.redirectToLogin = true;
    // Ajouter un header personnalisé pour indiquer la redirection
    res.setHeader("X-Redirect-To-Login", "true");
  }

  // S'assurer que le Content-Type est JSON
  res.setHeader("Content-Type", "application/json");
  res.status(statusCode).json(response);
}

/**
 * Fonction utilitaire pour créer des erreurs personnalisées
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  if (code !== undefined) {
    error.code = code;
  }
  return error;
}

