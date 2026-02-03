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
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
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

