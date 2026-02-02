/**
 * Utilitaires pour la gestion des dates et périodes
 * 
 * Fonctions pour gérer les filtres de période (semaine, mois, année)
 * et la construction des dates de transactions
 */

import type { PeriodFilter } from "../types/index";

/**
 * Construit une date complète à partir d'une date et d'une heure optionnelle
 * 
 * @param date - Date de base (peut être string ou Date)
 * @param time - Heure optionnelle au format "HH:mm"
 * @returns Date complète avec date et heure
 */
export function buildTransactionDate(date: Date | string, time?: string): Date {
  // Parser la date si c'est une string (accepte jj-mm-yyyy, YYYY-MM-DD ou ISO)
  const baseDate = typeof date === "string" ? parseDate(date) : date;

  if (time) {
    // Extraire les heures et minutes
    const [hours, minutes] = time.split(":").map(Number);
    baseDate.setHours(hours || 0, minutes || 0, 0, 0);
  } else {
    // Si pas d'heure, mettre à minuit
    baseDate.setHours(0, 0, 0, 0);
  }

  return baseDate;
}

/**
 * Obtient le début et la fin d'une période
 * 
 * @param period - Type de période (week, month, year)
 * @param referenceDate - Date de référence (par défaut: aujourd'hui)
 * @returns Objet avec startDate et endDate
 */
export function getPeriodDates(
  period: PeriodFilter,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const startDate = new Date(referenceDate);
  const endDate = new Date(referenceDate);

  switch (period) {
    case "week": {
      // Semaine calendaire (lundi à dimanche)
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);

      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case "month": {
      // Premier et dernier jour du mois
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(0); // Dernier jour du mois précédent
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case "year": {
      // Premier et dernier jour de l'année
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
  }

  return { startDate, endDate };
}

/**
 * Vérifie si une date est dans une période donnée
 * 
 * @param date - Date à vérifier
 * @param period - Type de période
 * @param referenceDate - Date de référence (par défaut: aujourd'hui)
 * @returns true si la date est dans la période
 */
export function isDateInPeriod(
  date: Date,
  period: PeriodFilter,
  referenceDate: Date = new Date()
): boolean {
  const { startDate, endDate } = getPeriodDates(period, referenceDate);
  return date >= startDate && date <= endDate;
}

/**
 * Formate une date pour l'affichage au format jj-mm-yyyy
 * 
 * @param date - Date à formater
 * @returns Date formatée (jj-mm-yyyy)
 */
export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formate une date pour l'affichage au format YYYY-MM-DD (pour compatibilité interne)
 * 
 * @param date - Date à formater
 * @returns Date formatée (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  const isoString = date.toISOString();
  const datePart = isoString.split("T")[0];
  // Vérifier que datePart existe (ne devrait jamais être undefined avec toISOString, mais TypeScript strict l'exige)
  if (!datePart) {
    throw new Error("Erreur lors du formatage de la date");
  }
  return datePart;
}

/**
 * Parse une date au format jj-mm-yyyy ou YYYY-MM-DD et retourne un objet Date
 * 
 * @param dateString - Date au format jj-mm-yyyy ou YYYY-MM-DD
 * @returns Date parsée
 */
export function parseDate(dateString: string): Date {
  // Format jj-mm-yyyy
  const jjMmYyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const jjMmYyyyMatch = dateString.match(jjMmYyyyPattern);
  
  if (jjMmYyyyMatch) {
    const [, day, month, year] = jjMmYyyyMatch;
    // Valider que tous les éléments sont présents
    if (!day || !month || !year) {
      throw new Error("Format de date invalide");
    }
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(date.getTime())) {
      throw new Error("Format de date invalide");
    }
    return date;
  }
  
  // Format YYYY-MM-DD (pour compatibilité)
  const yyyyMmDdPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const yyyyMmDdMatch = dateString.match(yyyyMmDdPattern);
  
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    // Valider que tous les éléments sont présents
    if (!year || !month || !day) {
      throw new Error("Format de date invalide");
    }
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(date.getTime())) {
      throw new Error("Format de date invalide");
    }
    return date;
  }
  
  // Essayer de parser comme date ISO ou autre format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error("Format de date invalide (accepte jj-mm-yyyy ou YYYY-MM-DD)");
  }
  return date;
}

/**
 * Obtient les dates de début et fin pour une période spécifique (premium)
 *
 * @param period - Type de période (day, week, month, year)
 * @param referenceDate - Date de référence (format dd-MM-yyyy, YYYY-MM-DD ou Date)
 * @returns Objet avec startDate et endDate
 */
export function getSpecificPeriodDates(
  period: "day" | "week" | "month" | "year",
  referenceDate: string | Date
): { startDate: Date; endDate: Date } {
  const refDate = typeof referenceDate === "string" ? parseDate(referenceDate) : referenceDate;
  const startDate = new Date(refDate);
  const endDate = new Date(refDate);

  switch (period) {
    case "day": {
      // Un jour spécifique (de 00:00:00 à 23:59:59)
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case "week": {
      // Semaine calendaire (lundi à dimanche) contenant la date de référence
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);

      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case "month": {
      // Premier et dernier jour du mois contenant la date de référence
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(0); // Dernier jour du mois précédent
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case "year": {
      // Premier et dernier jour de l'année contenant la date de référence
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
  }

  return { startDate, endDate };
}

/**
 * Parse une date au format dd-MM-yyyy ou YYYY-MM-DD et retourne les dates de début et fin de la journée
 *
 * @param dateString - Date au format dd-MM-yyyy ou YYYY-MM-DD
 * @returns Objet avec startDate (00:00:00) et endDate (23:59:59)
 */
export function parseDateRange(dateString: string): { startDate: Date; endDate: Date } {
  const startDate = parseDate(dateString);
  startDate.setHours(0, 0, 0, 0);

  const endDate = parseDate(dateString);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

