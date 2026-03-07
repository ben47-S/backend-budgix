/**
 * Contrôleurs pour les paiements Wave d'abonnement premium
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler.js";
import {
  initiatePayment,
  confirmPayment,
  getPaymentStatus,
  getUserPendingPayment,
  listPendingPayments,
  listPayments,
  approvePayment,
  rejectPayment,
  buildWavePaymentUrl,
} from "../services/payment.service.js";
import { formatDatesToISO } from "../utils/date-formatter.js";
import type {
  InitiatePaymentRequest,
  ConfirmPaymentRequest,
  RejectPaymentRequest,
} from "../types/index.js";

export async function initiatePaymentController(
  req: Request<{}, {}, InitiatePaymentRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { plan, isRenewal } = req.body;

    const payment = await initiatePayment(userId, plan, isRenewal);
    const waveUrl = buildWavePaymentUrl(Number(payment.amount));

res.status(201).json(formatDatesToISO({
      success: true,
      message: "Paiement initié",
      data: {
        payment,
        waveUrl,
      },
    }));
  } catch (error) {
    next(error);
  }
}

export async function confirmPaymentController(
  req: Request<{}, {}, ConfirmPaymentRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { paymentId, waveTransactionId, transferDate } = req.body;

    const payment = await confirmPayment(
      userId,
      paymentId,
      waveTransactionId,
      transferDate
    );

res.json(formatDatesToISO({
      success: true,
      message: "Paiement soumis pour vérification",
      data: { payment },
    }));
  } catch (error) {
    next(error);
  }
}

export async function getPaymentStatusController(
  req: Request<{ paymentId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { paymentId } = req.params;

    const payment = await getPaymentStatus(userId, paymentId);

res.json(formatDatesToISO({
      success: true,
      data: { payment },
    }));
  } catch (error) {
    next(error);
  }
}

export async function getUserPendingPaymentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const payment = await getUserPendingPayment(userId);

res.json(formatDatesToISO({
      success: true,
      data: { payment: payment || null },
    }));
  } catch (error) {
    next(error);
  }
}

export async function listPendingPaymentsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const payments = await listPendingPayments();

res.json(formatDatesToISO({
      success: true,
      data: { payments },
    }));
  } catch (error) {
    next(error);
  }
}

export async function listPaymentsController(
  req: Request<
    {},
    {},
    {},
    {
      status?: string;
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
    const { status, search, minAmount, maxAmount, startDate, endDate, page, limit } = req.query;

    const filters: any = {};

    if (status) {
      filters.status = status;
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

    const result = await listPayments(filters);

res.json(formatDatesToISO({
      success: true,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}

export async function approvePaymentController(
  req: Request<{ paymentId: string }, {}, { plan?: "MONTHLY" | "ANNUAL"; message?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const adminId = req.userId;
    if (!adminId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { paymentId } = req.params;
    const { plan, message } = req.body || {};

    const result = await approvePayment(adminId, paymentId, plan, message);

res.json(formatDatesToISO({
      success: true,
      message: "Paiement approuvé",
      data: result,
    }));
  } catch (error) {
    next(error);
  }
}

export async function rejectPaymentController(
  req: Request<{ paymentId: string }, {}, RejectPaymentRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const adminId = req.userId;
    if (!adminId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await rejectPayment(adminId, paymentId, reason);

res.json(formatDatesToISO({
      success: true,
      message: "Paiement refusé",
      data: { payment },
    }));
  } catch (error) {
    next(error);
  }
}
