/**
 * Utilitaires pour formater les dates dans les réponses API
 * 
 * Formate toutes les dates au format ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
 * pour une compatibilité maximale avec les frontends
 */

import { formatDate } from './date.js';

/**
 * Formate une date ou retourne null si la date est null/undefined
 * Format ISO 8601 complet avec heure (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
function formatDateToISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

/**
 * @deprecated Utiliser formatDateToISO pour le nouveau format
 * Formate une date au format jj-mm-yyyy (ancien format)
 */
function formatDateOrNull(date: Date | null | undefined): string | null {
  if (!date) return null;
  return formatDate(date);
}

/**
 * Vérifie si un objet est un Decimal de Prisma
 */
function isDecimal(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'd' in value &&
    'e' in value &&
    's' in value &&
    Array.isArray(value.d)
  );
}

/**
 * Convertit un objet Decimal de Prisma en string
 */
function decimalToString(decimal: any): string {
  // Si l'objet a une méthode toString, l'utiliser
  if (typeof decimal.toString === 'function') {
    return decimal.toString();
  }

  // Sinon, reconstruire le nombre manuellement
  const { d, e, s } = decimal;
  const digits = d.join('');
  const sign = s === -1 ? '-' : '';

  // Placer le point décimal
  if (e < 0) {
    // Nombre très petit, ajouter des zéros devant
    return `${sign}0.${'0'.repeat(-e - 1)}${digits}`;
  } else if (e >= digits.length) {
    // Nombre entier ou avec des zéros à la fin
    return `${sign}${digits}${'0'.repeat(e - digits.length + 1)}`;
  } else {
    // Nombre décimal normal
    const intPart = digits.slice(0, e + 1);
    const decPart = digits.slice(e + 1);
    return decPart ? `${sign}${intPart}.${decPart}` : `${sign}${intPart}`;
  }
}

/**
 * Formate récursivement toutes les dates en ISO 8601 et les Decimals en strings
 *
 * @param obj - Objet à formater
 * @returns Objet avec toutes les dates formatées en ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function formatDatesToISO<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  // Vérifier si c'est un Decimal de Prisma
  if (isDecimal(obj)) {
    return decimalToString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => formatDatesToISO(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const formatted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Vérifier si c'est un Decimal
      if (isDecimal(value)) {
        formatted[key] = decimalToString(value);
      }
      // Formater les champs de date connus en ISO 8601
      else if (
        key === 'date' ||
        key === 'startDate' ||
        key === 'endDate' ||
        key === 'periodStart' ||
        key === 'periodEnd' ||
        key === 'nextBillingDate' ||
        key === 'createdAt' ||
        key === 'updatedAt' ||
        key === 'scheduledAt' ||
        key === 'executedAt' ||
        key === 'scheduledFor' ||
        key === 'renewalDate' ||
        key === 'dueDate' ||
        key === 'timestamp' ||
        key.endsWith('Date') ||
        key.endsWith('At')
      ) {
        formatted[key] = formatDateToISO(value as Date | null | undefined);
      } else if (value instanceof Date) {
        formatted[key] = value.toISOString();
      } else if (Array.isArray(value)) {
        formatted[key] = value.map(item => formatDatesToISO(item));
      } else if (value !== null && typeof value === 'object') {
        formatted[key] = formatDatesToISO(value);
      } else {
        formatted[key] = value;
      }
    }

    return formatted as T;
  }

  return obj;
}

/**
 * @deprecated Utiliser formatDatesToISO pour le nouveau format standard
 * Formate récursivement toutes les dates au format jj-mm-yyyy (ancien format)
 */
export function formatDatesInObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return formatDate(obj) as unknown as T;
  }

  // Vérifier si c'est un Decimal de Prisma
  if (isDecimal(obj)) {
    return decimalToString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => formatDatesInObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const formatted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Vérifier si c'est un Decimal
      if (isDecimal(value)) {
        formatted[key] = decimalToString(value);
      }
      // Formater les champs de date connus
      else if (
        key === 'date' ||
        key === 'startDate' ||
        key === 'endDate' ||
        key === 'periodStart' ||
        key === 'periodEnd' ||
        key === 'nextBillingDate' ||
        key === 'createdAt' ||
        key === 'updatedAt' ||
        key === 'scheduledAt' ||
        key === 'executedAt' ||
        key === 'scheduledFor' ||
        key === 'renewalDate' ||
        key === 'dueDate' ||
        key === 'timestamp' ||
        key.endsWith('Date') ||
        key.endsWith('At')
      ) {
        formatted[key] = formatDateOrNull(value as Date | null | undefined);
      } else if (value instanceof Date) {
        formatted[key] = formatDate(value);
      } else if (Array.isArray(value)) {
        formatted[key] = value.map(item => formatDatesInObject(item));
      } else if (value !== null && typeof value === 'object') {
        formatted[key] = formatDatesInObject(value);
      } else {
        formatted[key] = value;
      }
    }

    return formatted as T;
  }

  return obj;
}
