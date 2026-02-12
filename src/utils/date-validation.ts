/**
 * Utilitaires pour la validation des dates
 * 
 * Toutes les dates doivent être au format jj-mm-yyyy
 * Cette fonction normalise le format en YYYY-MM-DD pour le traitement interne
 */

import { z } from "zod";

/**
 * Transforme une date au format jj-mm-yyyy en format YYYY-MM-DD pour traitement interne
 * 
 * @param dateString - Date au format jj-mm-yyyy (ex: "27-01-2026")
 * @returns Date au format YYYY-MM-DD (ex: "2026-01-27")
 * @throws Error si le format est invalide
 */
export function normalizeDateFromJJMMYYYY(dateString: string): string {
  // Format jj-mm-yyyy uniquement
  const jjMmYyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(jjMmYyyyPattern);
  
  if (!match) {
    throw new Error("Format de date invalide. Format attendu : jj-mm-yyyy (ex: 27-01-2026)");
  }

  const [, day, month, year] = match;

  // Valider que tous les éléments sont présents
  if (!day || !month || !year) {
    throw new Error("Format de date invalide. Format attendu : jj-mm-yyyy (ex: 27-01-2026)");
  }

  // Valider que la date est valide
  const dayNum = parseInt(day!, 10);
  const monthNum = parseInt(month!, 10);
  const yearNum = parseInt(year!, 10);
  
  const date = new Date(yearNum, monthNum - 1, dayNum);
  
  // Vérifier que la date est valide et correspond aux valeurs fournies
  if (
    isNaN(date.getTime()) ||
    date.getDate() !== dayNum ||
    date.getMonth() !== monthNum - 1 ||
    date.getFullYear() !== yearNum
  ) {
    throw new Error("Date invalide");
  }

  // Retourner au format YYYY-MM-DD pour traitement interne
  return `${year}-${month}-${day}`;
}

/**
 * Schéma Zod pour valider une date au format jj-mm-yyyy
 *
 * @deprecated Utilisez flexibleDateSchema pour accepter plusieurs formats
 * Accepte uniquement le format jj-mm-yyyy (ex: "27-01-2026")
 * Transforme automatiquement en YYYY-MM-DD pour le traitement interne
 */
export const dateSchemaJJMMYYYY = z
  .string({
    message: "La date doit être une chaîne de caractères",
  })
  .regex(
    /^\d{2}-\d{2}-\d{4}$/,
    "Format de date invalide. Format attendu : jj-mm-yyyy (ex: 27-01-2026)"
  )
  .refine(
    (val) => {
      try {
        normalizeDateFromJJMMYYYY(val);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Date invalide. Vérifiez que la date existe (ex: 31-02-2026 est invalide)",
    }
  )
  .transform(normalizeDateFromJJMMYYYY);

/**
 * Schéma Zod flexible acceptant plusieurs formats de dates
 *
 * Formats acceptés :
 * - ISO 8601 : "2026-01-27" ou "2026-01-27T14:30:00.000Z"
 * - jj/mm/aaaa : "27/01/2026" (format user-friendly)
 * - jj-mm-yyyy : "27-01-2026" (legacy, pour compatibilité avec anciennes versions)
 *
 * Transforme automatiquement en objet Date JavaScript
 *
 * @example
 * ```typescript
 * const schema = z.object({ date: flexibleDateSchema });
 * schema.parse({ date: "2026-01-27" }); // ✓ ISO 8601
 * schema.parse({ date: "27/01/2026" }); // ✓ Format slash
 * schema.parse({ date: "27-01-2026" }); // ✓ Format legacy
 * ```
 */
export const flexibleDateSchema = z
  .string({
    message: "La date doit être une chaîne de caractères",
  })
  .transform((val, ctx) => {
    // 1. Vérifier si c'est un format ISO 8601 (YYYY-MM-DD ou avec heure)
    const isoPattern = /^\d{4}-\d{2}-\d{2}/;
    if (isoPattern.test(val)) {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return date;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date ISO 8601 invalide",
      });
      return z.NEVER;
    }

    // 2. Vérifier format jj/mm/aaaa (avec slashes)
    const slashPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const slashMatch = val.match(slashPattern);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const dayNum = parseInt(day!, 10);
      const monthNum = parseInt(month!, 10);
      const yearNum = parseInt(year!, 10);

      const date = new Date(yearNum, monthNum - 1, dayNum);

      // Vérifier que la date est valide
      if (
        !isNaN(date.getTime()) &&
        date.getDate() === dayNum &&
        date.getMonth() === monthNum - 1 &&
        date.getFullYear() === yearNum
      ) {
        return date;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date invalide (ex: 31/02/2026 n'existe pas)",
      });
      return z.NEVER;
    }

    // 3. Vérifier format jj-mm-yyyy (avec tirets - legacy)
    const dashPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const dashMatch = val.match(dashPattern);
    if (dashMatch) {
      const [, day, month, year] = dashMatch;
      const dayNum = parseInt(day!, 10);
      const monthNum = parseInt(month!, 10);
      const yearNum = parseInt(year!, 10);

      const date = new Date(yearNum, monthNum - 1, dayNum);

      // Vérifier que la date est valide
      if (
        !isNaN(date.getTime()) &&
        date.getDate() === dayNum &&
        date.getMonth() === monthNum - 1 &&
        date.getFullYear() === yearNum
      ) {
        return date;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date invalide (ex: 31-02-2026 n'existe pas)",
      });
      return z.NEVER;
    }

    // Aucun format reconnu
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Format de date invalide. Formats acceptés : ISO 8601 (2026-01-27), jj/mm/aaaa (27/01/2026) ou jj-mm-yyyy (27-01-2026)",
    });
    return z.NEVER;
  });

