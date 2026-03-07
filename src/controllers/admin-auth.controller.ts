/**
 * Contrôleur d'authentification Admin - Connexion admin avec email + mot de passe
 * 
 * Ce contrôleur gère :
 * - La connexion des administrateurs avec email + mot de passe
 * - La définition du mot de passe pour les administrateurs
 */

import type { Request, Response, NextFunction } from "express";
import {
  authenticateAdmin,
  setAdminPassword,
  setAdminPasswordByEmail,
} from "../services/admin-auth.service.js";

/**
 * Authentifie un administrateur avec email + mot de passe
 * 
 * POST /api/admin/auth/login
 * Body: { email: string, password: string }
 */
export async function adminLoginController(
  req: Request<{}, {}, { email: string; password: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body;

    // Log pour déboguer (à retirer en production)
    if (process.env.NODE_ENV === "development") {
      console.log("[Admin Login] Tentative de connexion:", {
        email,
        passwordLength: password?.length,
        hasPassword: !!password,
      });
    }

    const { user, token } = await authenticateAdmin(email, password);

    res.json({
      success: true,
      message: "Connexion administrateur réussie",
      data: {
        user,
        token, // Token JWT pour l'authentification
      },
    });
  } catch (error) {
    // Log de l'erreur pour déboguer
    if (process.env.NODE_ENV === "development") {
      console.error("[Admin Login] Erreur:", error);
    }
    next(error);
  }
}

/**
 * Vérifie si le token admin est valide
 * 
 * GET /api/admin/auth/verify
 * Headers: Authorization: Bearer <token>
 */
export async function verifyAdminTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Si on arrive ici, le middleware requireAuth et requireAdmin ont validé le token
    // req.userId et req.user sont définis par le middleware
    
    res.json({
      success: true,
      valid: true,
      data: {
        userId: req.userId,
        email: req.user?.email,
        isPremium: req.user?.isPremium,
        role: req.user?.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Définit le mot de passe d'un administrateur (nécessite authentification admin)
 * 
 * POST /api/admin/auth/set-password
 * Headers: Authorization: Bearer <token>
 * Body: { password: string }
 */
export async function setAdminPasswordController(
  req: Request<{}, {}, { password: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    // req.userId est défini par le middleware requireAuth
    if (!req.userId) {
      return next(
        new Error("Utilisateur non authentifié")
      );
    }

    const { password } = req.body;

    const updatedUser = await setAdminPassword(req.userId, password);

    res.json({
      success: true,
      message: "Mot de passe défini avec succès",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Définit le mot de passe d'un administrateur par email (nécessite authentification admin)
 * 
 * POST /api/admin/auth/set-password-by-email
 * Headers: Authorization: Bearer <token>
 * Body: { email: string, password: string }
 */
export async function setAdminPasswordByEmailController(
  req: Request<{}, {}, { email: string; password: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body;

    const updatedUser = await setAdminPasswordByEmail(email, password);

    res.json({
      success: true,
      message: "Mot de passe défini avec succès",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

