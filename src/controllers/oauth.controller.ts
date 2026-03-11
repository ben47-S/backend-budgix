/**
 * Contrôleur OAuth - Gestion de l'authentification OAuth
 *
 * Gère les requêtes HTTP liées à l'authentification OAuth :
 * - Authentification via Google ID Token (mobile/web) **(déprécié)**
 * - Callback Google OAuth via Passport + JWT
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler.js";
import { generateToken } from "../services/jwt.service.js";

type GoogleAuthUser = {
  id: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  isPremium: boolean;
  status: string;
  role: string | null;
  createdAt: Date;
  isNewUser: boolean;
};

/**
 * Callback Google OAuth via Passport + JWT
 *
 * Cette route est appelée par Google après l'authentification OAuth 2.0.
 * Elle suppose que Passport a déjà authentifié l'utilisateur et placé
 * un objet utilisateur applicatif dans req.user.
 *
 * GET /api/auth/oauth/google/callback
 */
export async function googleCallbackJwtController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as GoogleAuthUser | undefined;

    if (!user) {
      throw createError(
        "Utilisateur Google non trouvé. Vérifiez la configuration OAuth.",
        400,
        "OAUTH_USER_NOT_FOUND"
      );
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
      isPremium: user.isPremium,
      role: user.role ?? undefined,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectUrl = `${frontendUrl}/callback?token=${token}&isNewUser=${user.isNewUser}`;

    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
}


