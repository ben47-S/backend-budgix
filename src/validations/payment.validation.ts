/**
 * Schémas de validation Zod pour les paiements Wave
 */

import { z } from "zod";
import { flexibleDateSchema } from "../utils/date-validation";

export const initiatePaymentSchema = {
  body: z.object({
    plan: z.enum(["MONTHLY", "ANNUAL"], {
      message: "Le plan doit être MONTHLY ou ANNUAL",
    }),
    isRenewal: z.boolean().optional(),
  }),
};

export const confirmPaymentSchema = {
  body: z.object({
    paymentId: z.string().min(1, "paymentId requis"),
    waveTransactionId: z.string().min(1, "L'ID Wave est requis").trim(),
    transferDate: flexibleDateSchema,
  }),
};

export const paymentStatusSchema = {
  params: z.object({
    paymentId: z.string().min(1, "paymentId requis"),
  }),
};

export const approvePaymentSchema = {
  params: z.object({
    paymentId: z.string().min(1, "paymentId requis"),
  }),
  body: z.object({
    plan: z.enum(["MONTHLY", "ANNUAL"], {
      message: "Le plan doit être MONTHLY ou ANNUAL",
    }).optional(),
  }).optional(),
};

export const rejectPaymentSchema = {
  params: z.object({
    paymentId: z.string().min(1, "paymentId requis"),
  }),
  body: z.object({
    reason: z.string().min(1, "La raison est requise").max(200, "La raison ne peut pas dépasser 200 caractères").trim(),
  }),
};
export const listPaymentsSchema = {
  query: z.object({
    status: z.enum(["PENDING_VERIFICATION", "APPROVED", "REJECTED"]).optional(),
    search: z.string().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20).optional(),
  }),
};