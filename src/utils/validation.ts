/**
 * Utilitaires de validation
 * 
 * Fonctions pour valider les données d'entrée
 */

/**
 * Valide un numéro de téléphone
 * Format attendu : +2250123456789 (10 chiffres après le +225)
 * 
 * @param phone - Numéro de téléphone à valider
 * @returns true si valide, false sinon
 */
export function isValidPhone(phone: string): boolean {
  // Supprimer les espaces et caractères spéciaux
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Vérifier le format : commence par + suivi de chiffres, ou juste des chiffres
  const phoneRegex = /^(\+?\d{13})$/;
  return phoneRegex.test(cleaned);
}

/**
 * Normalise un numéro de téléphone
 * Supprime les espaces et caractères spéciaux
 * 
 * @param phone - Numéro de téléphone à normaliser
 * @returns Le numéro normalisé
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}

/**
 * Valide un code OTP
 * Doit être exactement 6 chiffres
 * 
 * @param code - Code OTP à valider
 * @returns true si valide, false sinon
 */
export function isValidOTP(code: string): boolean {
  const otpRegex = /^\d{6}$/;
  return otpRegex.test(code);
}

