/**
 * Schémas de validation Zod pour les catégories
 */

import { z } from "zod";

/**
 * Schéma pour créer une catégorie
 */
export const createCategorySchema = {
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
 * Schéma pour les paramètres de requête de liste des catégories
 */
export const getCategoriesSchema = {
  query: z.object({
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
  }),
};

