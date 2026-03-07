/**
 * Schémas de validation Zod pour les statistiques premium
 * 
 * Permet aux utilisateurs premium de récupérer des statistiques
 * pour des périodes spécifiques (mois, semaine, jour ou période personnalisée)
 */

import { z } from "zod";
import { flexibleDateSchema } from "../utils/date-validation.js";

/**
 * Schéma pour les statistiques premium avec dates spécifiques
 * 
 * Accepte trois modes :
 * 1. startDate + endDate : Période personnalisée
 * 2. date + period : Période relative à une date spécifique (week/month/year)
 * 3. date seul : Un jour spécifique
 */
export const getPremiumStatsSchema = {
  query: z
    .object({
      // Option 1: Période personnalisée avec dates de début et fin
      startDate: flexibleDateSchema.optional(),
      endDate: flexibleDateSchema.optional(),

      // Option 2: Date de référence + période relative
      date: flexibleDateSchema.optional(),
      period: z.enum(["day", "week", "month", "year"]).optional(),
    })
    .refine(
      // Si startDate est fourni, endDate doit aussi être fourni
      (data) => {
        if (data.startDate && !data.endDate) return false;
        if (data.endDate && !data.startDate) return false;
        return true;
      },
      {
        message: "startDate et endDate doivent être fournis ensemble",
      }
    )
    .refine(
      // Si period est fourni, date doit aussi être fourni
      (data) => {
        if (data.period && !data.date) return false;
        return true;
      },
      {
        message: "date doit être fourni avec period",
      }
    )
    .refine(
      // Au moins une option doit être fournie
      (data) => {
        return (
          (data.startDate && data.endDate) ||
          (data.date && data.period) ||
          data.date !== undefined
        );
      },
      {
        message:
          "Vous devez fournir soit (startDate + endDate), soit (date + period), soit (date seul)",
      }
    )
    .refine(
      // Si startDate et endDate sont fournis, startDate doit être <= endDate
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      {
        message: "startDate doit être antérieure ou égale à endDate",
      }
    ),
};

