/**
 * Contrôleurs pour les demandes d'abonnement premium
 * Système simplifié sans Wave
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler.js";
import {
  createPremiumRequest,
  approvePremiumRequest,
  rejectPremiumRequest,
  getUserPendingRequest,
  listPendingRequests,
  listAllRequests,
  getRequestStatus,
} from "../services/payment.service.js";
import { formatDatesToISO } from "../utils/date-formatter.js";

/**
 * USER: Créer une demande premium
 */
export async function createRequestController(
  req: Request<{}, {}, { planType: "MONTHLY" | "ANNUAL" }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { planType } = req.body;

    const request = await createPremiumRequest(userId, planType);

    res.status(201).json(formatDatesToISO({
      success: true,
      message: "Demande envoyée avec succès",
      data: { request },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * USER: Voir sa demande en attente
 */
export async function getUserPendingRequestController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const request = await getUserPendingRequest(userId);

    res.json(formatDatesToISO({
      success: true,
      data: { request: request || null },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * USER: Récupérer le statut d'une demande
 */
export async function getRequestStatusController(
  req: Request<{ requestId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { requestId } = req.params;

    const request = await getRequestStatus(userId, requestId);

    res.json(formatDatesToISO({
      success: true,
      data: { request },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: Lister demandes en attente
 */
export async function listPendingRequestsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const requests = await listPendingRequests();

    res.json(formatDatesToISO({
      success: true,
      data: { requests },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: Lister toutes les demandes avec filtres (historique)
 */
export async function listAllRequestsController(
  req: Request<
    {},
    {},
    {},
    {
      status?: string;
      userId?: string;
      search?: string;
      minAmount?: string;
      maxAmount?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    }
  >,
  res: Response,
  next: NextFunction
) {
  try {
    const { status, userId, search, minAmount, maxAmount, startDate, endDate, page, limit } = req.query;

    const filters: any = {};

    if (status) {
      filters.status = status;
    }
    if (userId) {
      filters.userId = userId;
    }
    if (search) {
      filters.search = search;
    }
    if (minAmount) {
      filters.minAmount = Number(minAmount);
    }
    if (maxAmount) {
      filters.maxAmount = Number(maxAmount);
    }
    if (startDate) {
      filters.startDate = startDate;
    }
    if (endDate) {
      filters.endDate = endDate;
    }
    if (page) {
      filters.page = Number(page);
    }
    if (limit) {
      filters.limit = Number(limit);
    }

    const result = await listAllRequests(filters);

    res.json(formatDatesToISO({
      success: true,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: Approuver une demande
 */
export async function approveRequestController(
  req: Request<{ requestId: string }, {}, { adminNotes?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const adminId = req.userId;
    if (!adminId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { requestId } = req.params;
    const { adminNotes } = req.body || {};

    const result = await approvePremiumRequest(requestId, adminId, adminNotes);

    res.json(formatDatesToISO({
      success: true,
      message: "Demande approuvée avec succès",
      data: { request: result },
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: Rejeter une demande
 */
export async function rejectRequestController(
  req: Request<{ requestId: string }, {}, { adminNotes?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const adminId = req.userId;
    if (!adminId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { requestId } = req.params;
    const { adminNotes } = req.body;

    const request = await rejectPremiumRequest(requestId, adminId, adminNotes);

    res.json(formatDatesToISO({
      success: true,
      message: "Demande rejetée",
      data: { request },
    }));
  } catch (error) {
    next(error);
  }
}
