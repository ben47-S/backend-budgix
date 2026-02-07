/**
 * Schémas de validation Zod pour les routes admin
 */

import { z } from "zod";
import { dateSchemaJJMMYYYY } from "../utils/date-validation";

/**
 * Schéma pour les paramètres de requête de liste des utilisateurs
 */
export const getUsersSchema = {
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || (val > 0 && val <= 1000), {
        message: "La page doit être un nombre entre 1 et 1000",
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || (val > 0 && val <= 1000), {
        message: "La limite doit être un nombre entre 1 et 1000",
      }),
    search: z.string().optional(),
    isPremium: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => val === "true"),
    // Accepter "USER" ou "ADMIN" en majuscules ou minuscules, et préserver la valeur
    role: z
      .string()
      .optional()
      .refine((val) => !val || val.toUpperCase() === "USER" || val.toUpperCase() === "ADMIN", {
        message: "Le rôle doit être USER ou ADMIN",
      })
      .transform((val) => (val ? val.toUpperCase() as "USER" | "ADMIN" : undefined)),
    createdAtFrom: dateSchemaJJMMYYYY
      .optional()
      .transform((val: string | undefined) => (val ? new Date(val) : undefined)),
    createdAtTo: dateSchemaJJMMYYYY
      .optional()
      .transform((val: string | undefined) => (val ? new Date(val) : undefined)),
  }),
};

/**
 * Schéma pour mettre à jour un utilisateur
 */
export const updateUserSchema = {
  body: z
    .object({
      role: z.enum(["USER", "ADMIN"]).optional(),
      isPremium: z.boolean().optional(),
      username: z
        .string()
        .min(1, "Le nom d'utilisateur ne peut pas être vide")
        .max(50, "Le nom d'utilisateur ne peut pas dépasser 50 caractères")
        .trim()
        .optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      {
        message: "Au moins un champ doit être fourni pour la mise à jour",
      }
    ),
};

/**
 * Schéma pour créer une catégorie globale
 */
export const createGlobalCategorySchema = {
  body: z.object({
    name: z
      .string()
      .min(1, "Le nom de la catégorie est requis")
      .max(100, "Le nom de la catégorie ne peut pas dépasser 100 caractères")
      .trim(),
    type: z.enum(["INCOME", "EXPENSE"], {
      message: "Le type doit être INCOME ou EXPENSE",
    }),
  }),
};

/**
 * Schéma pour mettre à jour une catégorie globale
 */
export const updateGlobalCategorySchema = {
  body: z
    .object({
      name: z
        .string()
        .min(1, "Le nom de la catégorie ne peut pas être vide")
        .max(100, "Le nom de la catégorie ne peut pas dépasser 100 caractères")
        .trim()
        .optional(),
      type: z.enum(["INCOME", "EXPENSE"]).optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      {
        message: "Au moins un champ doit être fourni pour la mise à jour",
      }
    ),
};

/**
 * Schéma pour envoyer une notification push à un utilisateur depuis l'admin
 */
export const sendNotificationToUserSchema = {
  body: z.object({
    title: z
      .string()
      .min(1, "Le titre de la notification est requis")
      .max(100, "Le titre ne peut pas dépasser 100 caractères")
      .trim(),
    body: z
      .string()
      .min(1, "Le corps de la notification est requis")
      .max(500, "Le corps ne peut pas dépasser 500 caractères")
      .trim(),
    data: z.record(z.string(), z.any()).optional(),
  }),
};

/**
 * Schéma pour récupérer tous les abonnements externes (Admin)
 */
export const getAllExternalSubscriptionsSchema = {
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || (val > 0 && val <= 1000), {
        message: "La page doit être un nombre entre 1 et 1000",
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || (val > 0 && val <= 1000), {
        message: "La limite doit être un nombre entre 1 et 1000",
      }),
    search: z.string().optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => val === "true"),
    billingCycle: z
      .enum(["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"])
      .optional(),
    minAmount: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || val >= 0, {
        message: "Le montant minimum doit être positif",
      }),
    maxAmount: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || val >= 0, {
        message: "Le montant maximum doit être positif",
      }),
  }),
};

