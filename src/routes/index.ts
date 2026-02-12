/**
 * Fichier central pour regrouper toutes les routes
 * 
 * Ce fichier importe et configure toutes les routes de l'application
 */

import type { Router } from "express";
import { Router as ExpressRouter } from "express";

const router: Router = ExpressRouter();

// Routes d'authentification
import authRoutes from "./auth.routes";
router.use("/auth", authRoutes);

// Routes de catégories
import categoryRoutes from "./category.routes";
router.use("/categories", categoryRoutes);

// Routes de transactions
import transactionRoutes from "./transaction.routes";
router.use("/transactions", transactionRoutes);

// Routes de statistiques
import statsRoutes from "./stats.routes";
router.use("/stats", statsRoutes);

// Routes de profil utilisateur
import profileRoutes from "./profile.routes";
router.use("/profile", profileRoutes);

// Routes d'abonnements premium
import subscriptionRoutes from "./subscription.routes";
router.use("/subscriptions", subscriptionRoutes);

// Routes de paiements d'abonnement
import paymentRoutes from "./payment.routes";
router.use("/payments", paymentRoutes);

// Routes de dettes (premium uniquement)
import debtRoutes from "./debt.routes";
router.use("/debts", debtRoutes);

// Routes de budgets (premium uniquement)
import budgetRoutes from "./budget.routes";
router.use("/budgets", budgetRoutes);

// Routes de notifications push
import notificationRoutes from "./notification.routes";
router.use("/notifications", notificationRoutes);

// Routes d'abonnements externes (premium uniquement)
import externalSubscriptionRoutes from "./external-subscription.routes";
router.use("/external-subscriptions", externalSubscriptionRoutes);

// Routes d'authentification admin (connexion avec email + mot de passe)
// IMPORTANT: Monter AVANT /admin pour éviter que requireAuth s'applique à /admin/auth/login
import adminAuthRoutes from "./admin-auth.routes";
router.use("/admin/auth", adminAuthRoutes);

// Routes admin (nécessitent authentification + rôle ADMIN)
import adminRoutes from "./admin.routes";
router.use("/admin", adminRoutes);

// Routes de logs systèmes (admin uniquement)
import adminLogsRoutes from "./admin-logs.routes";
router.use("/admin/logs", adminLogsRoutes);

// Routes de discussions de support client
import discussionRoutes from "./discussion.routes";
router.use("/discussions", discussionRoutes);

// Routes d'avis utilisateurs (note + commentaire)
import reviewRoutes from "./review.routes";
router.use("/reviews", reviewRoutes);

// Routes de suggestions d'amélioration
import improvementSuggestionRoutes from "./improvement-suggestion.routes";
router.use("/improvement-suggestions", improvementSuggestionRoutes);

// Routes de test (à retirer en production)
import testRoutes from "./test.routes";
router.use("/test", testRoutes);

export default router;

