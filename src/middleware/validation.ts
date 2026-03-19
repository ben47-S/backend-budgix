/**
 * Middleware de validation avec Zod
 * 
 * Ce middleware valide les données de requête (body, query, params)
 * selon les schémas Zod fournis.
 */

import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { createError } from "./errorHandler.js";
import { sanitizeForLog } from "../utils/log-sanitizer.js";

/**
 * Type pour les schémas de validation Zod
 * Accepte un objet avec body/query/params
 */
type ValidationSchema = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

/**
 * Middleware de validation générique
 * 
 * @param schema - Schéma de validation Zod avec body, query et/ou params
 * @returns Middleware Express
 */
export function validate(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Log pour déboguer - Ne JAMAIS logger passwords, tokens, etc.
      if (process.env.NODE_ENV === "development" && schema.body) {
        console.log("[Validation] Body reçu:", sanitizeForLog(req.body));
      }

      // Valider chaque partie de la requête si le schéma est fourni
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
        if (process.env.NODE_ENV === "development") {
          console.log("[Validation] Body validé:", sanitizeForLog(req.body));
        }
      }

      if (schema.query) {
        // Sauvegarder les valeurs originales avant validation
        const originalQuery = { ...req.query } as Record<string, unknown>;
        
        // Valider les query params
        const validatedQuery = await schema.query.parseAsync(req.query || {}) as Record<string, unknown>;
        
        // Modifier les propriétés de req.query une par une
        // S'assurer que req.query existe avant de modifier
        if (!req.query) {
          (req as { query?: Record<string, unknown> }).query = {};
        }
        const queryObj = req.query as Record<string, unknown>;
        
        // Préserver toutes les valeurs validées
        for (const [key, value] of Object.entries(validatedQuery)) {
          queryObj[key] = value;
        }
        
        // Préserver les valeurs originales qui n'ont pas été transformées par Zod
        // (pour les champs optionnels qui pourraient être absents de validatedQuery)
        for (const [key, value] of Object.entries(originalQuery)) {
          if (!(key in validatedQuery) && value !== undefined) {
            queryObj[key] = value;
          }
        }
      }

      if (schema.params) {
        // Valider les params
        const validatedParams = await schema.params.parseAsync(req.params || {}) as Record<string, unknown>;
        
        // Modifier les propriétés de req.params une par une
        // S'assurer que req.params existe avant de modifier
        if (!req.params) {
          (req as { params?: Record<string, unknown> }).params = {};
        }
        const paramsObj = req.params as Record<string, unknown>;
        for (const [key, value] of Object.entries(validatedParams)) {
          paramsObj[key] = value;
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formater les erreurs Zod de manière lisible
        const errors = error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        // Créer une erreur avec les détails de validation
        const errorMessage = errors.length === 1 && errors[0]
          ? errors[0].message 
          : `Erreur de validation : ${errors.map((e) => e.message).join(", ")}`;
        
        const validationError = createError(
          errorMessage,
          400,
          "VALIDATION_ERROR"
        );
        
        // Ajouter les erreurs détaillées à l'erreur pour un meilleur debugging
        (validationError as any).validationErrors = errors;
        
        return next(validationError);
      }

      // Erreur inattendue
      next(error);
    }
  };
}

/**
 * Formate les erreurs Zod pour une réponse API plus claire
 */
export function formatZodError(error: ZodError): {
  message: string;
  errors: Array<{ field: string; message: string }>;
} {
  const errors = error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return {
    message: `Erreur de validation : ${errors.map((e) => e.message).join(", ")}`,
    errors,
  };
}

