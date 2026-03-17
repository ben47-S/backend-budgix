/**
 * Schémas de validation Zod pour la gestion du profil utilisateur
 */

import { z } from "zod";

/**
 * Schéma pour ajouter/mettre à jour le téléphone
 */
export const addPhoneSchema = {
  body: z.object({
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(
        /^\+?\d{13}$/,
        "Format de numéro de téléphone invalide. Format attendu : +2250123456789"
      ),
  }),
};

/**
 * Schéma pour vérifier et mettre à jour le téléphone
 */
export const verifyPhoneSchema = {
  body: z.object({
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(
        /^\+?\d{13}$/,
        "Format de numéro de téléphone invalide. Format attendu : +2250123456789"
      ),
    code: z
      .string()
      .length(6, "Le code OTP doit contenir exactement 6 chiffres")
      .regex(/^\d{6}$/, "Le code OTP doit contenir uniquement des chiffres"),
  }),
};

/**
 * Schéma pour ajouter/mettre à jour l'email
 */
export const addEmailSchema = {
  body: z.object({
    email: z.string().email("Format d'email invalide"),
  }),
};

/**
 * Schéma pour vérifier et mettre à jour l'email
 */
export const verifyEmailSchema = {
  body: z.object({
    email: z.string().email("Format d'email invalide"),
    code: z
      .string()
      .length(6, "Le code de vérification doit contenir exactement 6 chiffres")
      .regex(/^\d{6}$/, "Le code de vérification doit contenir uniquement des chiffres"),
  }),
};

/**
 * Schéma pour envoyer un code de suppression de compte
 */
export const sendDeleteAccountCodeSchema = {
  body: z.object({
    method: z.enum(["email", "phone"]),
  }),
};

/**
 * Schéma pour confirmer la suppression de compte
 */
export const confirmDeleteAccountSchema = {
  body: z.object({
    method: z.enum(["email", "phone"]),
    code: z
      .string()
      .length(6, "Le code doit contenir exactement 6 chiffres")
      .regex(/^\d{6}$/, "Le code doit contenir uniquement des chiffres"),
  }),
};

/**
 * Schéma pour mettre à jour le username
 */
export const updateUsernameSchema = {
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
      .max(18, "Le nom d'utilisateur ne peut pas dépasser 18 caractères")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, underscores (_), tirets (-) et points (.)"
      )
      .refine(
        (value) => (value.match(/[a-zA-Z]/g) || []).length >= 3,
        "Le nom d'utilisateur doit contenir au moins 3 lettres"
      ),
  }),
};

