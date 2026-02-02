/**
 * Schémas de validation Zod pour les abonnements externes
 * 
 * Validation des données pour la création et mise à jour
 * d'abonnements externes (Netflix, Spotify, etc.)
 */

import { z } from "zod";
import { dateSchemaJJMMYYYY } from "../utils/date-validation";

/**
 * Enum pour les cycles de facturation
 */
const BillingCycleEnum = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"]);

/**
 * Schéma pour créer un abonnement externe
 */
export const createExternalSubscriptionSchema = {
  body: z
    .object({
      name: z
        .string({ message: "Le nom est requis" })
        .min(1, "Le nom doit contenir au moins 1 caractère")
        .max(100, "Le nom ne peut pas dépasser 100 caractères"),
      amount: z
        .number({ message: "Le montant est requis" })
        .int("Le montant doit être un nombre entier")
        .positive("Le montant doit être positif")
        .max(999999999999, "Le montant est trop élevé"),
      startDate: dateSchemaJJMMYYYY,
      billingCycle: BillingCycleEnum,
      customDays: z
        .number()
        .int("Le nombre de jours doit être un entier")
        .min(1, "Le nombre de jours doit être au moins 1")
        .max(365, "Le nombre de jours ne peut pas dépasser 365")
        .optional()
        .nullable(),
      categoryId: z
        .string()
        .cuid("Format d'ID de catégorie invalide")
        .optional()
        .nullable(),
      notes: z
        .string()
        .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        // Si billingCycle est CUSTOM, customDays doit être fourni
        if (data.billingCycle === "CUSTOM") {
          return data.customDays !== null && data.customDays !== undefined && data.customDays > 0;
        }
        return true;
      },
      {
        message: "customDays est requis lorsque billingCycle est CUSTOM",
        path: ["customDays"],
      }
    ),
};

/**
 * Schéma pour mettre à jour un abonnement externe
 * Tous les champs sont optionnels
 */
export const updateExternalSubscriptionSchema = {
  body: z
    .object({
      name: z
        .string()
        .min(1, "Le nom doit contenir au moins 1 caractère")
        .max(100, "Le nom ne peut pas dépasser 100 caractères")
        .optional(),
      amount: z
        .number()
        .int("Le montant doit être un nombre entier")
        .positive("Le montant doit être positif")
        .max(999999999999, "Le montant est trop élevé")
        .optional(),
      startDate: dateSchemaJJMMYYYY.optional(),
      billingCycle: BillingCycleEnum.optional(),
      customDays: z
        .number()
        .int("Le nombre de jours doit être un entier")
        .min(1, "Le nombre de jours doit être au moins 1")
        .max(365, "Le nombre de jours ne peut pas dépasser 365")
        .optional()
        .nullable(),
      categoryId: z
        .string()
        .cuid("Format d'ID de catégorie invalide")
        .optional()
        .nullable(),
      notes: z
        .string()
        .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
        .optional()
        .nullable(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => {
        // Si billingCycle est CUSTOM, customDays doit être fourni
        if (data.billingCycle === "CUSTOM") {
          return data.customDays !== null && data.customDays !== undefined && data.customDays > 0;
        }
        return true;
      },
      {
        message: "customDays est requis lorsque billingCycle est CUSTOM",
        path: ["customDays"],
      }
    ),
};

/**
 * Schéma pour les paramètres de requête de liste des abonnements
 */
export const getExternalSubscriptionsSchema = {
  query: z.object({
    isActive: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "La limite doit être un nombre")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(1000))
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "L'offset doit être un nombre")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(0))
      .optional(),
  }),
};

/**
 * Schéma pour les paramètres de route (ID)
 */
export const externalSubscriptionIdSchema = {
  params: z.object({
    id: z.string().cuid("Format d'ID invalide"),
  }),
};

/**
 * Schéma pour renouveler un abonnement
 */
export const renewExternalSubscriptionSchema = {
  body: z
    .object({
      renewalDate: dateSchemaJJMMYYYY.optional(),
    })
    .optional(),
};

