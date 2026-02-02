/**
 * Middleware de logging des requêtes HTTP
 * 
 * Enregistre toutes les requêtes entrantes avec leurs détails
 * (méthode, URL, statut de réponse, temps de réponse, etc.)
 */

import type { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

/**
 * Middleware pour logger les requêtes HTTP
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Capturer la fin de la réponse
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    // Déterminer le niveau de log selon le statut
    const logLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "http";
    
    // Créer le message de log
    const message = `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip}`;
    
    // Log avec métadonnées
    logger[logLevel](message, {
      method,
      url: originalUrl,
      statusCode,
      duration,
      ip,
      userAgent: req.get("user-agent"),
    });
  });
  
  next();
}

