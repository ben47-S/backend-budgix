/**
 * Service de gestion des demandes d'abonnement premium
 *
 * Système simplifié :
 * - L'utilisateur crée une demande PENDING
 * - L'admin approuve (APPROVED) ou rejette (REJECTED)
 * - Pas de vérification Wave, gestion manuelle uniquement
 */

import { prisma } from "../lib/prisma.js";
import { createError } from "../middleware/errorHandler.js";
import { renewOrCreateSubscription } from "./subscription.service.js";
import { sendNotificationToUser } from "./notification.service.js";
import { logEvent } from "./log.service.js";
import type { SubscriptionPlan } from "../generated/prisma/client.js";

const prismaClient = prisma as any;

/**
 * Créer une demande premium
 */
export async function createPremiumRequest(userId: string, planType: SubscriptionPlan) {
  const amount = planType === 'MONTHLY' ? 450 : 4200;

  // Vérifier si une demande pending existe déjà
  const existingPending = await prismaClient.subscriptionPayment.findFirst({
    where: { userId, status: 'PENDING' }
  });

  if (existingPending) {
    throw createError('Vous avez déjà une demande en attente', 400, 'REQUEST_ALREADY_EXISTS');
  }

  // Créer la demande
  const request = await prismaClient.subscriptionPayment.create({
    data: {
      userId,
      planType,
      amount,
      status: 'PENDING',
    }
  });

  // Log
  await logEvent({
    scope: 'BUSINESS',
    level: 'INFO',
    action: 'premium_request_created',
    userId,
    metadata: { requestId: request.id, planType, amount }
  });

  return request;
}

/**
 * Approuver une demande premium (admin)
 */
export async function approvePremiumRequest(
  requestId: string,
  adminId: string,
  adminNotes?: string
) {
  const request = await prismaClient.subscriptionPayment.findUnique({
    where: { id: requestId },
    include: { user: true }
  });

  if (!request) {
    throw createError('Demande introuvable', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status !== 'PENDING') {
    throw createError('Demande introuvable ou déjà traitée', 400, 'INVALID_REQUEST_STATUS');
  }

  // Transaction: Update request + activer premium + créer subscription
  const result = await prismaClient.$transaction(async (tx: any) => {
    // Update request
    const updatedRequest = await tx.subscriptionPayment.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: adminId,
        adminNotes,
        updatedAt: new Date()
      }
    });

    // Activer premium
    await tx.user.update({
      where: { id: request.userId },
      data: { isPremium: true }
    });

    // Créer subscription active
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (request.planType === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await tx.subscription.create({
      data: {
        userId: request.userId,
        plan: request.planType,
        price: request.amount,
        startDate,
        endDate,
      }
    });

    return updatedRequest;
  });

  // Notification utilisateur
  const planText = request.planType === 'MONTHLY' ? 'mensuel' : 'annuel';
  await sendNotificationToUser(
    request.userId,
    'Demande approuvée',
    `Votre demande d'abonnement premium ${planText} a été approuvée ✅`,
    {
      type: 'PAYMENT_APPROVED',
      requestId: result.id,
      planType: request.planType,
    }
  );

  // Log
  await logEvent({
    scope: 'BUSINESS',
    level: 'INFO',
    action: 'premium_request_approved',
    adminId,
    targetId: request.userId,
    metadata: { requestId, planType: request.planType }
  });

  return result;
}

/**
 * Rejeter une demande premium (admin)
 */
export async function rejectPremiumRequest(
  requestId: string,
  adminId: string,
  adminNotes?: string
) {
  const request = await prismaClient.subscriptionPayment.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw createError('Demande introuvable', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status !== 'PENDING') {
    throw createError('Demande introuvable ou déjà traitée', 400, 'INVALID_REQUEST_STATUS');
  }

  const updatedRequest = await prismaClient.subscriptionPayment.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      approvedById: adminId,
      adminNotes,
      updatedAt: new Date()
    }
  });

  // Notification utilisateur
  await sendNotificationToUser(
    request.userId,
    'Demande refusée',
    `Votre demande d'abonnement premium a été refusée${adminNotes ? ` : ${adminNotes}` : '.'}`,
    {
      type: 'PAYMENT_REJECTED',
      requestId: updatedRequest.id,
      planType: request.planType,
      reason: adminNotes || 'Non spécifié',
    }
  );

  // Log
  await logEvent({
    scope: 'BUSINESS',
    level: 'INFO',
    action: 'premium_request_rejected',
    adminId,
    targetId: request.userId,
    metadata: { requestId, reason: adminNotes }
  });

  return updatedRequest;
}

/**
 * Récupérer la demande pending d'un utilisateur
 */
export async function getUserPendingRequest(userId: string) {
  return await prismaClient.subscriptionPayment.findFirst({
    where: { userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Lister toutes les demandes pending (pour admin)
 */
export async function listPendingRequests() {
  return await prismaClient.subscriptionPayment.findMany({
    where: { status: 'PENDING' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
          isPremium: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Lister toutes les demandes avec filtres (historique admin)
 */
export interface ListRequestsFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  userId?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function listAllRequests(filters: ListRequestsFilters) {
  const {
    status,
    userId,
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

  if (userId) {
    where.userId = userId;
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
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
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

  // Récupérer les demandes avec pagination
  const requests = await prismaClient.subscriptionPayment.findMany({
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
      approvedBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Récupérer le statut d'une demande (pour utilisateur)
 */
export async function getRequestStatus(userId: string, requestId: string) {
  const request = await prismaClient.subscriptionPayment.findUnique({
    where: { id: requestId },
  });

  if (!request || request.userId !== userId) {
    throw createError("Demande introuvable", 404, "REQUEST_NOT_FOUND");
  }

  return request;
}
