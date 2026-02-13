/**
 * Types TypeScript personnalisés
 * 
 * Définitions de types et interfaces réutilisables
 */

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Types pour les requêtes d'authentification
export interface OtpRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
}

// Types pour les transactions
export interface CreateTransactionRequest {
  amount: number;
  categoryId: string;
  date: Date | string; // Date obligatoire (jour du mois en cours)
  time?: string; // Heure optionnelle (format HH:mm) - utilisée si "aujourd'hui" avec heure spécifiée
  note?: string;
}

// Types pour les catégories
export interface CreateCategoryRequest {
  name: string;
  type: "INCOME" | "EXPENSE";
}

// Types pour les filtres de période
export type PeriodFilter = "week" | "month" | "year";

// Types pour la gestion du profil utilisateur
export interface AddPhoneRequest {
  phone: string;
}

export interface VerifyPhoneRequest {
  phone: string;
  code: string;
}

export interface AddEmailRequest {
  email: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

// Types pour les abonnements
export interface CreateSubscriptionRequest {
  plan: "MONTHLY" | "ANNUAL";
}

// Types pour les paiements Wave
export interface InitiatePaymentRequest {
  plan: "MONTHLY" | "ANNUAL";
  isRenewal?: boolean;
}

export interface ConfirmPaymentRequest {
  paymentId: string;
  waveTransactionId: string;
  transferDate: Date;
}

export interface RejectPaymentRequest {
  reason: string;
}

// Types pour les dettes
export interface CreateDebtRequest {
  type: "OWED_TO_ME" | "I_OWE";
  contactName: string;
  amount: number;
  notes?: string;
}

export interface UpdateDebtRequest {
  type?: "OWED_TO_ME" | "I_OWE";
  contactName?: string;
  amount?: number;
  isPaid?: boolean;
  notes?: string;
}

