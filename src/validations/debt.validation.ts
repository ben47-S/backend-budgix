/**
 * Schémas de validation Zod pour les dettes
 */

import { z } from "zod";

/**
 * Schéma pour créer une dette
 */
export const createDebtSchema = {
  body: z.object({
    type: z.enum(["OWED_TO_ME", "I_OWE"], {
      message: "Le type doit être OWED_TO_ME ou I_OWE",
    }),
    contactName: z
      .string()
      .min(1, "Le nom du contact est requis")
      .max(100, "Le nom du contact ne peut pas dépasser 100 caractères")
      .trim(),
    amount: z
      .number("Le montant doit être un nombre")
      .positive("Le montant doit être positif")
      .max(999999999999.99, "Le montant est trop élevé"),
    notes: z
      .string()
      .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
      .optional()
      .nullable(),
    repaymentDate: z
      .string()
      .datetime("La date de remboursement doit être au format ISO")
      .optional()
      .nullable(),
  }),
};

/**
 * Schéma pour mettre à jour une dette
 */
export const updateDebtSchema = {
  params: z.object({
    id: z.string().cuid("Format d'ID invalide"),
  }),
  body: z.object({
    type: z.enum(["OWED_TO_ME", "I_OWE"]).optional(),
    contactName: z
      .string()
      .min(1, "Le nom du contact ne peut pas être vide")
      .max(100, "Le nom du contact ne peut pas dépasser 100 caractères")
      .trim()
      .optional(),
    amount: z
      .number("Le montant doit être un nombre")
      .positive("Le montant doit être positif")
      .max(999999999.99, "Le montant est trop élevé")
      .optional(),
    isPaid: z.boolean().optional(),
    notes: z
      .string()
      .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
      .optional()
      .nullable(),
    repaymentDate: z
      .string()
      .datetime("La date de remboursement doit être au format ISO")
      .optional()
      .nullable(),
  }),
};

/**
 * Schéma pour les paramètres de requête de liste des dettes
 */
export const getDebtsSchema = {
  query: z.object({
    type: z.enum(["OWED_TO_ME", "I_OWE"]).optional(),
    isPaid: z
      .string()
      .regex(/^(true|false)$/, "isPaid doit être 'true' ou 'false'")
      .transform((val) => val === "true")
      .optional(),
  }),
};

/**
 * Schéma pour les paramètres de route (ID)
 */
export const debtIdSchema = {
  params: z.object({
    id: z.string().cuid("Format d'ID invalide"),
  }),
};

