/**
 * Schémas de validation Zod pour les demandes d'abonnement premium
 * Système simplifié sans Wave
 */

import { z } from "zod";

/**
 * Validation pour la création d'une demande premium
 */
export const createRequestSchema = {
  body: z.object({
    planType: z.enum(["MONTHLY", "ANNUAL"], {
      message: "Le type de plan doit être MONTHLY ou ANNUAL",
    }),
  }),
};

/**
 * Validation pour récupérer le statut d'une demande
 */
export const requestStatusSchema = {
  params: z.object({
    requestId: z.string().min(1, "requestId requis"),
  }),
};

/**
 * Validation pour approuver une demande (admin)
 */
export const approveRequestSchema = {
  params: z.object({
    requestId: z.string().min(1, "requestId requis"),
  }),
  body: z
    .object({
      adminNotes: z
        .string()
        .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
        .trim()
        .optional(),
    })
    .optional(),
};

/**
 * Validation pour rejeter une demande (admin)
 */
export const rejectRequestSchema = {
  params: z.object({
    requestId: z.string().min(1, "requestId requis"),
  }),
  body: z
    .object({
      adminNotes: z
        .string()
        .max(500, "Les notes ne peuvent pas dépasser 500 caractères")
        .trim()
        .optional(),
    })
    .optional(),
};

/**
 * Validation pour lister les demandes avec filtres (admin)
 */
export const listRequestsSchema = {
  query: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    userId: z.string().optional(),
    search: z.string().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20).optional(),
  }),
};
