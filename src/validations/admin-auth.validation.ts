/**
 * Schémas de validation Zod pour l'authentification admin
 */

import { z } from "zod";

/**
 * Schéma pour la connexion admin (email + mot de passe)
 */
export const adminLoginSchema = {
  body: z.object({
    email: z
      .string()
      .email("Format d'email invalide")
      .min(1, "L'email est requis")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(1, "Le mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  }),
};

/**
 * Schéma pour définir le mot de passe admin
 */
export const setAdminPasswordSchema = {
  body: z.object({
    password: z
      .string()
      .min(1, "Le mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .max(100, "Le mot de passe ne peut pas dépasser 100 caractères"),
  }),
};

/**
 * Schéma pour définir le mot de passe admin par email
 */
export const setAdminPasswordByEmailSchema = {
  body: z.object({
    email: z
      .string()
      .email("Format d'email invalide")
      .min(1, "L'email est requis")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(1, "Le mot de passe est requis")
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .max(100, "Le mot de passe ne peut pas dépasser 100 caractères"),
  }),
};

