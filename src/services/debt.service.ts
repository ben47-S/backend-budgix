/**
 * Service de gestion des dettes (fonctionnalité premium)
 * 
 * Ce service gère :
 * - La création de dettes (OWED_TO_ME ou I_OWE)
 * - La récupération des dettes d'un utilisateur
 * - La mise à jour du statut de paiement (isPaid)
 * - La suppression de dettes
 * - Le filtrage par type et statut de paiement
 */

import { prisma } from "../lib/prisma";
import { createError } from "../middleware/errorHandler";
import { getUserById } from "./auth.service";
import type { DebtType } from "../../generated/prisma/client";

/**
 * Crée une nouvelle dette
 * 
 * @param userId - ID de l'utilisateur
 * @param type - Type de dette (OWED_TO_ME ou I_OWE)
 * @param contactName - Nom de la personne
 * @param amount - Montant de la dette
 * @param notes - Notes optionnelles
 * @returns La dette créée
 */
export async function createDebt(
  userId: string,
  type: DebtType,
  contactName: string,
  amount: number,
  notes?: string
) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Valider les données
  if (!contactName || contactName.trim().length === 0) {
    throw createError(
      "Le nom du contact est requis",
      400,
      "INVALID_CONTACT_NAME"
    );
  }

  if (!amount || amount <= 0) {
    throw createError(
      "Le montant doit être supérieur à 0",
      400,
      "INVALID_AMOUNT"
    );
  }

  // Créer la dette
  const debt = await prisma.debt.create({
    data: {
      userId,
      type,
      contactName: contactName.trim(),
      amount,
      notes: notes?.trim() || null,
    },
  });

  return debt;
}

/**
 * Récupère toutes les dettes d'un utilisateur avec filtres optionnels
 * 
 * @param userId - ID de l'utilisateur
 * @param type - Type de dette (optionnel)
 * @param isPaid - Statut de paiement (optionnel)
 * @returns Liste des dettes
 */
export async function getDebts(
  userId: string,
  type?: DebtType,
  isPaid?: boolean
) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Construire la condition where
  const where: any = { userId };

  if (type !== undefined) {
    where.type = type;
  }

  if (isPaid !== undefined) {
    where.isPaid = isPaid;
  }

  // Récupérer les dettes
  const debts = await prisma.debt.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
  });

  return debts;
}

/**
 * Récupère une dette par son ID
 * 
 * @param debtId - ID de la dette
 * @param userId - ID de l'utilisateur
 * @returns La dette trouvée
 */
export async function getDebtById(debtId: string, userId: string) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  const debt = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId,
    },
  });

  if (!debt) {
    throw createError(
      "Dette non trouvée",
      404,
      "DEBT_NOT_FOUND"
    );
  }

  return debt;
}

/**
 * Met à jour une dette
 * 
 * @param debtId - ID de la dette
 * @param userId - ID de l'utilisateur
 * @param updates - Données à mettre à jour
 * @returns La dette mise à jour
 */
export async function updateDebt(
  debtId: string,
  userId: string,
  updates: {
    type?: DebtType;
    contactName?: string;
    amount?: number;
    isPaid?: boolean;
    notes?: string;
  }
) {
  // Vérifier que la dette existe et appartient à l'utilisateur
  const existingDebt = await getDebtById(debtId, userId);

  // Préparer les données de mise à jour
  const data: any = {};

  if (updates.type !== undefined) {
    data.type = updates.type;
  }

  if (updates.contactName !== undefined) {
    if (updates.contactName.trim().length === 0) {
      throw createError(
        "Le nom du contact ne peut pas être vide",
        400,
        "INVALID_CONTACT_NAME"
      );
    }
    data.contactName = updates.contactName.trim();
  }

  if (updates.amount !== undefined) {
    if (updates.amount <= 0) {
      throw createError(
        "Le montant doit être supérieur à 0",
        400,
        "INVALID_AMOUNT"
      );
    }
    data.amount = updates.amount;
  }

  if (updates.isPaid !== undefined) {
    data.isPaid = updates.isPaid;
  }

  if (updates.notes !== undefined) {
    data.notes = updates.notes.trim() || null;
  }

  // Mettre à jour la dette
  const updatedDebt = await prisma.debt.update({
    where: { id: debtId },
    data,
  });

  return updatedDebt;
}

/**
 * Supprime une dette
 * 
 * @param debtId - ID de la dette
 * @param userId - ID de l'utilisateur
 */
export async function deleteDebt(debtId: string, userId: string) {
  // Vérifier que la dette existe et appartient à l'utilisateur
  await getDebtById(debtId, userId);

  // Supprimer la dette
  await prisma.debt.delete({
    where: { id: debtId },
  });
}

/**
 * Récupère les statistiques des dettes d'un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @returns Statistiques des dettes
 */
export async function getDebtStats(userId: string) {
  // Vérifier que l'utilisateur existe et est premium
  const user = await getUserById(userId);
  
  if (!user.isPremium) {
    throw createError(
      "Fonctionnalité premium - Abonnement requis",
      403,
      "PREMIUM_REQUIRED"
    );
  }

  // Récupérer toutes les dettes
  const debts = await prisma.debt.findMany({
    where: { userId },
  });

  // Calculer les statistiques
  const totalOwedToMe = debts
    .filter((d) => d.type === "OWED_TO_ME")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalIOwe = debts
    .filter((d) => d.type === "I_OWE")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const paidOwedToMe = debts
    .filter((d) => d.type === "OWED_TO_ME" && d.isPaid)
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const paidIOwe = debts
    .filter((d) => d.type === "I_OWE" && d.isPaid)
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const unpaidOwedToMe = totalOwedToMe - paidOwedToMe;
  const unpaidIOwe = totalIOwe - paidIOwe;

  return {
    totalOwedToMe,
    totalIOwe,
    paidOwedToMe,
    paidIOwe,
    unpaidOwedToMe,
    unpaidIOwe,
    netBalance: unpaidOwedToMe - unpaidIOwe, // Solde net (ce qu'on doit recevoir - ce qu'on doit)
    totalDebts: debts.length,
    paidDebts: debts.filter((d) => d.isPaid).length,
    unpaidDebts: debts.filter((d) => !d.isPaid).length,
  };
}

