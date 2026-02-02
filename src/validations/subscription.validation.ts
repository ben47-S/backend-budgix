/**
 * Schémas de validation Zod pour les abonnements
 */

import { z } from "zod";

/**
 * Schéma pour créer/mettre à jour un abonnement
 */
export const createSubscriptionSchema = {
  body: z.object({
    plan: z.enum(["MONTHLY", "ANNUAL"], {
      message: "Le plan doit être MONTHLY ou ANNUAL",
    }),
  }),
};

