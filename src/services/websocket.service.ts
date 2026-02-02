/**
 * Service WebSocket - Gestion des connexions WebSocket pour les discussions
 * 
 * Ce service gère :
 * - Les connexions WebSocket des utilisateurs et admins
 * - L'authentification des connexions WebSocket via JWT
 * - La diffusion des messages en temps réel
 * - La gestion des rooms pour isoler les discussions
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { verifyToken } from "./jwt.service";
import { sendMessage, getDiscussionById } from "./discussion.service";
import logger from "../lib/logger";

// Interface pour les données utilisateur stockées dans la socket
interface SocketUser {
  userId: string;
  role?: string | undefined;
  isAdmin: boolean;
}

// Extension de l'interface Socket pour inclure les données utilisateur
interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

// Instance du serveur WebSocket (sera initialisée dans initWebSocket)
let io: SocketIOServer | null = null;

// Map pour stocker les connexions actives par userId
const activeConnections = new Map<string, Set<string>>(); // userId -> Set de socketIds

/**
 * Initialise le serveur WebSocket avec le serveur HTTP Express
 */
export function initWebSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL 
        ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
        : ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Middleware d'authentification pour les connexions WebSocket
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        logger.warn("Tentative de connexion WebSocket sans token");
        return next(new Error("Token d'authentification manquant"));
      }

      // Vérifier le token JWT
      const decoded = verifyToken(token);
      
      // Stocker les informations utilisateur dans la socket
      socket.user = {
        userId: decoded.userId,
        ...(decoded.role && { role: decoded.role }),
        isAdmin: decoded.role === "ADMIN",
      };

      next();
    } catch (error: any) {
      logger.error(`Erreur d'authentification WebSocket: ${error.message}`);
      next(new Error("Token invalide ou expiré"));
    }
  });

  // Gestion des connexions
  io.on("connection", (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    const { userId, isAdmin } = user;

    logger.info(`Connexion WebSocket: ${userId} (Admin: ${isAdmin})`);

    // Ajouter la connexion à la map des connexions actives
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(socket.id);

    // Joindre la room de l'utilisateur pour recevoir ses notifications
    socket.join(`user:${userId}`);

    // Si c'est un admin, rejoindre aussi la room des admins
    if (isAdmin) {
      socket.join("admins");
      logger.info(`Admin ${userId} a rejoint la room des admins`);
    }

    // Événement: Rejoindre une discussion
    socket.on("join-discussion", async (data: { discussionId: string }) => {
      try {
        const { discussionId } = data;

        // Vérifier que l'utilisateur a accès à cette discussion
        await getDiscussionById(discussionId, userId, isAdmin);

        // Rejoindre la room de la discussion
        socket.join(`discussion:${discussionId}`);
        logger.info(`Utilisateur ${userId} a rejoint la discussion ${discussionId}`);

        // Confirmer la connexion
        socket.emit("discussion-joined", { discussionId });
      } catch (error: any) {
        logger.error(`Erreur lors de la jonction à la discussion: ${error.message}`);
        socket.emit("error", { message: error.message || "Erreur lors de la jonction à la discussion" });
      }
    });

    // Événement: Quitter une discussion
    socket.on("leave-discussion", (data: { discussionId: string }) => {
      const { discussionId } = data;
      socket.leave(`discussion:${discussionId}`);
      logger.info(`Utilisateur ${userId} a quitté la discussion ${discussionId}`);
    });

    // Événement: Envoyer un message
    socket.on("send-message", async (data: { discussionId: string; content: string }) => {
      try {
        const { discussionId, content } = data;

        if (!content || content.trim().length === 0) {
          socket.emit("error", { message: "Le contenu du message ne peut pas être vide" });
          return;
        }

        // Envoyer le message via le service
        const message = await sendMessage(
          discussionId,
          content,
          isAdmin ? null : userId,
          isAdmin ? "ADMIN" : "USER"
        );

        // Diffuser le message à tous les participants de la discussion
        io!.to(`discussion:${discussionId}`).emit("new-message", {
          message: {
            id: message.id,
            discussionId: message.discussionId,
            senderId: message.senderId,
            senderType: message.senderType,
            content: message.content,
            read: message.read,
            createdAt: message.createdAt,
          },
        });

        // Notifier les admins si c'est un utilisateur qui envoie
        if (!isAdmin) {
          io!.to("admins").emit("discussion-updated", {
            discussionId,
            userId: message.discussion.user.id,
            lastMessage: {
              content: message.content,
              createdAt: message.createdAt,
            },
          });
        }

        logger.info(`Message envoyé dans la discussion ${discussionId} par ${userId}`);
      } catch (error: any) {
        logger.error(`Erreur lors de l'envoi du message: ${error.message}`);
        socket.emit("error", { message: error.message || "Erreur lors de l'envoi du message" });
      }
    });

    // Événement: Marquer les messages comme lus
    socket.on("mark-as-read", async (data: { discussionId: string }) => {
      try {
        const { discussionId } = data;

        // Vérifier l'accès à la discussion
        await getDiscussionById(discussionId, userId, isAdmin);

        // Mettre à jour les messages comme lus (via le service)
        const { markDiscussionAsRead } = await import("./discussion.service");
        await markDiscussionAsRead(discussionId, userId, isAdmin);

        // Notifier les autres participants
        socket.to(`discussion:${discussionId}`).emit("messages-read", {
          discussionId,
          readBy: userId,
        });

        logger.info(`Messages marqués comme lus dans la discussion ${discussionId} par ${userId}`);
      } catch (error: any) {
        logger.error(`Erreur lors du marquage des messages comme lus: ${error.message}`);
        socket.emit("error", { message: error.message || "Erreur lors du marquage des messages" });
      }
    });

    // Gestion de la déconnexion
    socket.on("disconnect", () => {
      logger.info(`Déconnexion WebSocket: ${userId}`);

      // Retirer la connexion de la map
      const userConnections = activeConnections.get(userId);
      if (userConnections) {
        userConnections.delete(socket.id);
        if (userConnections.size === 0) {
          activeConnections.delete(userId);
        }
      }
    });
  });

  logger.info("Serveur WebSocket initialisé");
  return io;
}

/**
 * Récupère l'instance du serveur WebSocket
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("WebSocket server not initialized. Call initWebSocket first.");
  }
  return io;
}

/**
 * Envoie un événement à un utilisateur spécifique
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Envoie un événement à tous les admins
 */
export function emitToAdmins(event: string, data: any) {
  if (!io) return;
  io.to("admins").emit(event, data);
}

/**
 * Envoie un événement à tous les participants d'une discussion
 */
export function emitToDiscussion(discussionId: string, event: string, data: any) {
  if (!io) return;
  io.to(`discussion:${discussionId}`).emit(event, data);
}

/**
 * Vérifie si un utilisateur est connecté
 */
export function isUserConnected(userId: string): boolean {
  return activeConnections.has(userId) && activeConnections.get(userId)!.size > 0;
}

/**
 * Récupère le nombre de connexions actives pour un utilisateur
 */
export function getUserConnectionCount(userId: string): number {
  return activeConnections.get(userId)?.size || 0;
}

