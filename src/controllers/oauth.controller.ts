/**
 * Contrôleur OAuth - Gestion de l'authentification OAuth
 *
 * Gère les requêtes HTTP liées à l'authentification OAuth :
 * - Authentification via Google ID Token (mobile/web)
 * - Callback Google OAuth (web legacy)
 */

import type { Request, Response, NextFunction } from "express";
import {
  authenticateWithGoogle,
  verifyGoogleIdToken,
} from "../services/oauth.service";
import { createError } from "../middleware/errorHandler";
import type { GoogleProfile } from "../services/oauth.service";

/**
 * Callback Google OAuth
 * Cette route est appelée par Google après l'authentification
 * 
 * GET /api/auth/oauth/google/callback
 * Query params: code (fourni par Google)
 */
export async function googleCallbackController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Le profil Google devrait être disponible dans req.user après la stratégie Passport
    // Pour l'instant, on simule avec les données de la requête
    // TODO: Intégrer avec Passport pour récupérer le vrai profil
    
    const profile = req.user as GoogleProfile | undefined;

    if (!profile) {
      throw createError(
        "Profil Google non trouvé. Vérifiez la configuration OAuth.",
        400,
        "OAUTH_PROFILE_NOT_FOUND"
      );
    }

    // Authentifier ou créer l'utilisateur
    const { user, token, isNewUser } = await authenticateWithGoogle(profile);

    // Rediriger vers le frontend avec le token
    // En développement, on peut retourner le token directement
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&isNewUser=${isNewUser}`;

    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
}

/**
 * Route de test pour OAuth (à utiliser avec des données de test)
 *
 * POST /api/auth/oauth/google/test
 * Body: { email: string, displayName?: string }
 */
export async function googleTestController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, displayName } = req.body;

    if (!email) {
      throw createError("Email requis", 400, "EMAIL_REQUIRED");
    }

    // Créer un profil de test
    const testProfile: GoogleProfile = {
      id: "test-google-id",
      emails: [{ value: email, verified: true }],
      displayName: displayName || undefined,
    };

    // Authentifier ou créer l'utilisateur
    const { user, token, isNewUser } =
      await authenticateWithGoogle(testProfile);

    res.json({
      success: true,
      message: isNewUser
        ? "Inscription réussie via Google"
        : "Connexion réussie via Google",
      data: {
        user,
        token,
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authentification Google via ID Token
 * Utilisé par les applications mobiles et web modernes
 *
 * POST /api/auth/oauth/google
 * Body: { idToken: string }
 */
export async function googleAuthController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      throw createError("Token Google requis", 400, "ID_TOKEN_REQUIRED");
    }

    // Valider le token et authentifier l'utilisateur
    const { user, token, isNewUser } = await verifyGoogleIdToken(idToken);

    res.json({
      success: true,
      message: isNewUser
        ? "Inscription réussie via Google"
        : "Connexion réussie via Google",
      data: {
        user,
        token,
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

