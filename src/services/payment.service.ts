/**
 * Service de gestion des paiements Wave pour l'abonnement premium
 * 
 * Gère :
 * - L'initiation d'un paiement
 * - La confirmation manuelle par l'utilisateur
 * - La validation/rejet par l'admin
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { calculateSubscriptionPrice, createOrUpdateSubscription, renewOrCreateSubscription } from "./subscription.service.js";
import { sendNotificationToUser } from "./notification.service.js";
import type { SubscriptionPlan } from "../generated/prisma/client.js";

const prismaClient = prisma as any;

export async function initiatePayment(
  userId: string,
  plan: SubscriptionPlan,
  isRenewal: boolean = false
) {
  const amount = calculateSubscriptionPrice(plan);

  // Vérifier s'il existe un paiement PENDING_VERIFICATION en cours
  const pendingVerification = await prismaClient.subscriptionPayment.findFirst({
    where: {
      userId,
      status: "PENDING_VERIFICATION",
    },
    orderBy: { createdAt: "desc" },
  });

  // Si un paiement est en attente de vérification, mettre à jour le plan et isRenewal si différent
  if (pendingVerification) {
    if (pendingVerification.plan !== plan || pendingVerification.isRenewal !== isRenewal) {
      const updatedPayment = await prismaClient.subscriptionPayment.update({
        where: { id: pendingVerification.id },
        data: {
          plan,
          amount,
          isRenewal,
        },
      });
      return updatedPayment;
    }
    return pendingVerification;
  }

  // Vérifier s'il existe un paiement PENDING expiré (plus de 24h)
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const expiredPending = await prismaClient.subscriptionPayment.findFirst({
    where: {
      userId,
      status: "PENDING",
      createdAt: {
        lt: twentyFourHoursAgo,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Si un paiement PENDING a expiré, le rejeter automatiquement
  // SANS envoyer de notification au client (comportement intentionnel)
  if (expiredPending) {
    await prismaClient.subscriptionPayment.update({
      where: { id: expiredPending.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: "Paiement expiré (aucune confirmation dans les 24 heures)",
      },
    });
  }

  // Vérifier s'il existe un paiement PENDING valide (moins de 24h)
  const validPending = await prismaClient.subscriptionPayment.findFirst({
    where: {
      userId,
      status: "PENDING",
      createdAt: {
        gte: twentyFourHoursAgo,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Si un paiement PENDING valide existe, mettre à jour le plan et isRenewal si différent
  if (validPending) {
    if (validPending.plan !== plan || validPending.isRenewal !== isRenewal) {
      const updatedPayment = await prismaClient.subscriptionPayment.update({
        where: { id: validPending.id },
        data: {
          plan,
          amount,
          isRenewal,
        },
      });
      return updatedPayment;
    }
    return validPending;
  }

  // Sinon, créer un nouveau paiement
  const payment = await prismaClient.subscriptionPayment.create({
    data: {
      userId,
      plan,
      amount,
      status: "PENDING",
      isRenewal,
    },
  });

  return payment;
}

export function buildWavePaymentUrl(amountXOF: number): string {
  const baseUrl = process.env.WAVE_PAYMENT_URL;
  if (!baseUrl) {
    throw createError(
      "Configuration Wave manquante",
      500,
      "WAVE_CONFIG_ERROR"
    );
  }
  return `${baseUrl}?amount=${amountXOF}`;
}

export async function confirmPayment(
  userId: string,
  paymentId: string,
  waveTransactionId: string,
  transferDate: Date
) {
  const payment = await prismaClient.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.userId !== userId) {
    throw createError("Paiement introuvable", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status !== "PENDING") {
    throw createError("Paiement déjà soumis ou traité", 400, "INVALID_PAYMENT_STATUS");
  }

  // Normaliser la date pour comparaison (comparer juste le jour, pas l'heure)
  const startOfDay = new Date(transferDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(transferDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Vérifier si c'est un ancien paiement APPROUVÉ (même ID Wave + même date de transfert)
  // Seuls les paiements approuvés sont considérés comme "anciens paiements"
  const existingApprovedPayment = await prismaClient.subscriptionPayment.findFirst({
    where: {
      waveTransactionId,
      transferDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: "APPROVED", // Vérifier seulement les paiements approuvés
      id: { not: paymentId },
    },
  });

  if (existingApprovedPayment) {
    throw createError(
      "Ceci est un ancien paiement. Effectuez votre paiement et entrez les bonnes données.",
      409,
      "OLD_PAYMENT_DETECTED"
    );
  }

  // Vérifier si l'ID Wave est déjà utilisé avec une date différente
  const existingWaveTx = await prismaClient.subscriptionPayment.findFirst({
    where: {
      waveTransactionId,
      id: { not: paymentId },
    },
  });

  if (existingWaveTx) {
    throw createError("Cet ID Wave est déjà utilisé", 409, "WAVE_TRANSACTION_EXISTS");
  }

  const updated = await prismaClient.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      status: "PENDING_VERIFICATION",
      waveTransactionId,
      transferDate,
    },
  });

  await notifyAdminsPaymentPending(updated.id, updated.amount, updated.plan, updated.userId);

  return updated;
}

export async function getPaymentStatus(userId: string, paymentId: string) {
  const payment = await prismaClient.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.userId !== userId) {
    throw createError("Paiement introuvable", 404, "PAYMENT_NOT_FOUND");
  }

  return payment;
}

export async function getUserPendingPayment(userId: string) {
  return prismaClient.subscriptionPayment.findFirst({
    where: {
      userId,
      status: "PENDING_VERIFICATION",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPendingPayments() {
  return prismaClient.subscriptionPayment.findMany({
    where: { status: "PENDING_VERIFICATION" },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
        },
      },
    },
  });
}

export interface ListPaymentsFilters {
  status?: "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function listPayments(filters: ListPaymentsFilters) {
  const {
    status,
    search,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = filters;

  // Construire les conditions de filtrage
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {};
    if (minAmount !== undefined) {
      where.amount.gte = minAmount;
    }
    if (maxAmount !== undefined) {
      where.amount.lte = maxAmount;
    }
  }

  if (startDate || endDate) {
    where.transferDate = {};
    if (startDate) {
      where.transferDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.transferDate.lte = new Date(endDate);
    }
  }

  // Filtre de recherche (username, email, phone)
  const searchWhere = search
    ? {
        user: {
          OR: [
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        },
      }
    : {};

  const whereWithSearch = {
    ...where,
    ...searchWhere,
  };

  // Récupérer le nombre total
  const total = await prismaClient.subscriptionPayment.count({
    where: whereWithSearch,
  });

  // Récupérer les paiements avec pagination
  const payments = await prismaClient.subscriptionPayment.findMany({
    where: whereWithSearch,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function approvePayment(
  adminId: string,
  paymentId: string,
  customPlan?: SubscriptionPlan,
  customMessage?: string
) {
  const payment = await prismaClient.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw createError("Paiement introuvable", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status !== "PENDING_VERIFICATION") {
    throw createError("Paiement non éligible pour approbation", 400, "INVALID_PAYMENT_STATUS");
  }

  // Utiliser le plan personnalisé si fourni, sinon utiliser le plan du paiement
  const finalPlan = customPlan || payment.plan;

  const updatedPayment = await prismaClient.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: adminId,
      rejectionReason: null,
      rejectedAt: null,
      rejectedById: null,
    },
  });

  // Créer ou renouveler l'abonnement avec le plan final
  const subscription = await renewOrCreateSubscription(
    payment.userId,
    finalPlan,
    payment.isRenewal || false
  );

  // Utiliser le message personnalisé si fourni, sinon générer un message automatique
  let notificationMessage: string;

  if (customMessage) {
    // Message personnalisé par l'admin
    notificationMessage = customMessage;
  } else {
    // Message de notification adaptée selon le plan et le contexte
    const planText = finalPlan === "MONTHLY" ? "mensuel" : "annuel";
    const isRenewal = payment.isRenewal || false;

    if (customPlan && customPlan !== payment.plan) {
      notificationMessage = `Votre paiement a été approuvé. Votre abonnement premium ${planText} est activé ✅`;
    } else if (isRenewal) {
      notificationMessage = `Votre renouvellement a été approuvé. Votre abonnement premium ${planText} a été prolongé ✅`;
    } else {
      notificationMessage = "Votre paiement a été approuvé. Votre abonnement premium est activé ✅";
    }
  }

  await sendNotificationToUser(
    payment.userId,
    "Paiement approuvé",
    notificationMessage,
    {
      type: "PAYMENT_APPROVED",
      paymentId: updatedPayment.id,
      plan: finalPlan,
    }
  );

  return { payment: updatedPayment, subscription };
}

export async function rejectPayment(adminId: string, paymentId: string, reason: string) {
  const payment = await prismaClient.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw createError("Paiement introuvable", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status !== "PENDING_VERIFICATION") {
    throw createError("Paiement non éligible pour rejet", 400, "INVALID_PAYMENT_STATUS");
  }

  const updatedPayment = await prismaClient.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedById: adminId,
      rejectionReason: reason,
    },
  });

  await sendNotificationToUser(
    payment.userId,
    "Paiement refusé",
    `Votre paiement a été refusé : ${reason}`,
    {
      type: "PAYMENT_REJECTED",
      paymentId: updatedPayment.id,
      plan: payment.plan,
      reason,
    }
  );

  return updatedPayment;
}

async function notifyAdminsPaymentPending(
  paymentId: string,
  amount: unknown,
  plan: SubscriptionPlan,
  userId: string
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (admins.length === 0) {
    return;
  }

  const amountValue = typeof amount === "object" && amount !== null && "toString" in amount
    ? (amount as { toString: () => string }).toString()
    : String(amount);

  await Promise.all(
    admins.map(async (admin) => {
      const result = await sendNotificationToUser(
        admin.id,
        "Paiement à valider",
        "Un paiement Wave est en attente de validation.",
        {
          type: "PAYMENT_PENDING_VERIFICATION",
          paymentId,
          userId,
          plan,
          amount: amountValue,
        }
      );

      if (!result.sent) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "PAYMENT_PENDING_VERIFICATION" as any,
            title: "Paiement à valider",
            body: "Un paiement Wave est en attente de validation.",
            data: {
              paymentId,
              userId,
              plan,
              amount: amountValue,
            } as any,
            read: false,
          },
        });
      }
    })
  );
}
