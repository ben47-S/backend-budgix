/**
 * Utilitaires de formatage des prix
 * 
 * - Les prix d'abonnement premium sont formatés en USD (dollars)
 * - Tous les autres prix sont formatés en FCFA
 */

/**
 * Formate un prix d'abonnement premium en USD
 * 
 * @param price - Prix en dollars (ex: 1.09, 10.99)
 * @returns Prix formaté avec devise USD (ex: "1.09 USD" ou "$1.09")
 */
export function formatSubscriptionPrice(price: number | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  
  // Formater avec 2 décimales et ajouter USD
  return `${numPrice.toFixed(2)} USD`;
}

/**
 * Formate un prix en FCFA
 * 
 * @param price - Prix en FCFA (peut être un nombre ou une string)
 * @returns Prix formaté avec devise FCFA (ex: "10 000 FCFA")
 */
export function formatPriceInFCFA(price: number | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  
  // Formater avec séparateurs de milliers et ajouter FCFA
  return `${numPrice.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} FCFA`;
}

/**
 * Formate le nom du plan d'abonnement
 * 
 * @param plan - Plan d'abonnement (MONTHLY ou ANNUAL)
 * @returns Nom formaté du plan (ex: "Mensuel" ou "Annuel")
 */
export function formatSubscriptionPlan(plan: "MONTHLY" | "ANNUAL"): string {
  switch (plan) {
    case "MONTHLY":
      return "Mensuel";
    case "ANNUAL":
      return "Annuel";
    default:
      return plan;
  }
}

/**
 * Calcule les économies réalisées avec l'abonnement annuel
 * 
 * @param monthlyPrice - Prix mensuel en USD
 * @param annualPrice - Prix annuel en USD
 * @returns Pourcentage d'économies formaté (ex: "16%")
 */
export function calculateSavings(monthlyPrice: number, annualPrice: number): string {
  // Prix annuel si on payait mensuellement pendant 12 mois
  const yearlyIfMonthly = monthlyPrice * 12;
  
  // Calculer les économies en pourcentage
  const savings = ((yearlyIfMonthly - annualPrice) / yearlyIfMonthly) * 100;
  
  return `${Math.round(savings)}%`;
}

