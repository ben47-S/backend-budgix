/**
 * Schémas de validation Zod pour les budgets (fonctionnalité premium)
 *
 * Permet de valider :
 * - La création/mise à jour d'un budget pour une période
 * - La récupération de la progression des budgets sur une période
 * - La suppression d'un budget
 */

import { z } from "zod";
import { flexibleDateSchema } from "../utils/date-validation";

/**
 * Schéma pour créer ou mettre à jour un budget
 *
 * Modes supportés :
 * - Budget global (toutes catégories) : sans categoryId
 * - Budget par catégorie : avec categoryId
 */
export const upsertBudgetSchema = {
  body: z
    .object({
      amount: z
        .number("Le montant du budget doit être un nombre")
        .positive("Le montant du budget doit être positif")
        .max(999999999999.99, "Le montant du budget est trop élevé"),
      startDate: flexibleDateSchema,
      endDate: flexibleDateSchema,
      categoryId: z
        .string()
        .cuid("Format d'ID de catégorie invalide")
        .optional()
        .nullable(),
      type: z.enum(["MONTHLY", "CUSTOM"]).optional().default("CUSTOM"),
    })
    .refine(
      (data) => {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      },
      {
        message: "La date de début doit être antérieure ou égale à la date de fin",
        path: ["startDate"],
      }
    ),
};

/**
 * Schéma pour créer ou mettre à jour un budget mensuel
 */
export const upsertMonthlyBudgetSchema = {
  body: z.object({
    amount: z
      .number("Le montant du budget doit être un nombre")
      .positive("Le montant du budget doit être positif")
      .max(999999999999.99, "Le montant du budget est trop élevé"),
    year: z
      .number("L'année doit être un nombre")
      .int("L'année doit être un entier")
      .min(2000, "L'année doit être >= 2000")
      .max(2100, "L'année doit être <= 2100"),
    month: z
      .number("Le mois doit être un nombre")
      .int("Le mois doit être un entier")
      .min(0, "Le mois doit être entre 0 et 11 (0 = janvier)")
      .max(11, "Le mois doit être entre 0 et 11 (11 = décembre)"),
    categoryId: z
      .string()
      .cuid("Format d'ID de catégorie invalide")
      .optional()
      .nullable(),
  }),
};

/**
 * Schéma pour récupérer les budgets mensuels
 */
export const getMonthlyBudgetsSchema = {
  query: z.object({
    year: z
      .string()
      .regex(/^\d+$/, "L'année doit être un nombre")
      .transform((val) => Number(val))
      .refine((val) => val >= 2000 && val <= 2100, "L'année doit être entre 2000 et 2100")
      .optional(),
    month: z
      .string()
      .regex(/^\d+$/, "Le mois doit être un nombre")
      .transform((val) => Number(val))
      .refine((val) => val >= 0 && val <= 11, "Le mois doit être entre 0 et 11")
      .optional(),
    includePast: z
      .string()
      .regex(/^(true|false)$/, "includePast doit être 'true' ou 'false'")
      .transform((val) => val === "true")
      .optional(),
    categoryId: z
      .string()
      .cuid("Format d'ID de catégorie invalide")
      .nullable()
      .optional(),
  }),
};

/**
 * Schéma pour récupérer la progression des budgets sur une période
 */
export const getBudgetsOverviewSchema = {
  query: z
    .object({
      startDate: flexibleDateSchema,
      endDate: flexibleDateSchema,
    })
    .refine(
      (data) => {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      },
      {
        message: "La date de début doit être antérieure ou égale à la date de fin",
        path: ["startDate"],
      }
    ),
};

/**
 * Schéma pour supprimer un budget
 */
export const deleteBudgetSchema = {
  params: z.object({
    id: z.string().cuid("Format d'ID de budget invalide"),
  }),
};


