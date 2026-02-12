/**
 * Schémas de validation Zod pour les transactions
 */

import { z } from "zod";
import { flexibleDateSchema } from "../utils/date-validation";

/**
 * Schéma pour créer une transaction
 */
export const createTransactionSchema = {
  body: z.object({
    amount: z
      .number("Le montant doit être un nombre")
      .positive("Le montant doit être positif")
      .max(999999999999.99, "Le montant est trop élevé"),
    categoryId: z
      .string()
      .min(1, "L'ID de la catégorie est requis")
      .cuid("Format d'ID de catégorie invalide"),
    date: flexibleDateSchema,
    time: z
      .string()
      .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (HH:mm)")
      .optional(),
    note: z
      .string()
      .max(500, "La note ne peut pas dépasser 500 caractères")
      .optional()
      .nullable(),
  }),
};

/**
 * Schéma pour les paramètres de requête de liste des transactions
 */
export const getTransactionsSchema = {
  query: z.object({
    period: z.enum(["week", "month", "year"]).optional(),
    categoryId: z.string().cuid().optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "La limite doit être un nombre")
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(100))
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
 * Schéma pour les paramètres de requête du résumé des transactions
 */
export const getTransactionSummarySchema = {
  query: z.object({
    period: z.enum(["week", "month", "year"]).optional(),
  }),
};

/**
 * Schéma pour supprimer toutes les transactions
 * Requiert une confirmation explicite pour éviter les suppressions accidentelles
 */
export const deleteAllTransactionsSchema = {
  body: z.object({
    confirm: z
      .boolean({
        message: "La confirmation doit être un booléen",
      })
      .refine((val) => val === true, {
        message: "Vous devez confirmer la suppression en envoyant { confirm: true }",
      }),
  }),
};

