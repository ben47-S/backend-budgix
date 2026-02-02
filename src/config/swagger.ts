/**
 * Configuration Swagger/OpenAPI
 * 
 * Configuration pour générer la documentation API automatiquement
 */

import swaggerJsdoc from "swagger-jsdoc";
import type { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Budgix API",
    version: "1.0.0",
    description: `
# API Budgix - Gestion de Budget

API REST pour l'application de gestion de budget Budgix.

## Authentification

L'API utilise l'authentification JWT via Bearer Token. 
Incluez le token dans le header \`Authorization: Bearer <token>\` pour les routes protégées.

## Fonctionnalités

- **Authentification** : OTP par téléphone et OAuth (Google)
- **Catégories** : Gestion des catégories globales et personnalisées
- **Transactions** : Création et gestion des transactions (revenus/dépenses)
- **Statistiques** : Statistiques détaillées sur les transactions
- **Profil** : Gestion du profil utilisateur (téléphone, email)
- **Premium** : Abonnements et gestion des dettes (fonctionnalités premium)
- **Discussions** : Système de support client avec WebSocket en temps réel

## Codes d'erreur

- \`400\` : Requête invalide
- \`401\` : Non authentifié
- \`403\` : Accès refusé (fonctionnalité premium requise)
- \`404\` : Ressource non trouvée
- \`409\` : Conflit (ressource déjà existante)
- \`500\` : Erreur serveur interne
    `,
    contact: {
      name: "Support Budgix",
      email: "support@budgix.com",
    },
  },
  servers: [
    {
      url: process.env.API_URL || "http://localhost:3000/api",
      description: "Serveur de développement",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT obtenu après authentification (OTP ou OAuth)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Message d'erreur descriptif",
              },
              code: {
                type: "string",
                example: "ERROR_CODE",
              },
            },
          },
        },
      },
      Success: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Opération réussie",
          },
          data: {
            type: "object",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+2250123456789",
          },
          email: {
            type: "string",
            nullable: true,
            example: "user@example.com",
          },
          username: {
            type: "string",
            nullable: true,
            example: "john_doe",
          },
          isPremium: {
            type: "boolean",
            example: false,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          name: {
            type: "string",
            example: "Alimentation",
          },
          type: {
            type: "string",
            enum: ["INCOME", "EXPENSE"],
            example: "EXPENSE",
          },
          userId: {
            type: "string",
            nullable: true,
            example: null,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          amount: {
            type: "number",
            example: 50.00,
          },
          date: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
          note: {
            type: "string",
            nullable: true,
            example: "Achat au supermarché",
          },
          category: {
            $ref: "#/components/schemas/Category",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Subscription: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          plan: {
            type: "string",
            enum: ["MONTHLY", "ANNUAL"],
            example: "MONTHLY",
          },
          price: {
            type: "number",
            example: 9.99,
          },
          startDate: {
            type: "string",
            format: "date-time",
          },
          endDate: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Debt: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          type: {
            type: "string",
            enum: ["OWED_TO_ME", "I_OWE"],
            example: "OWED_TO_ME",
          },
          contactName: {
            type: "string",
            example: "Jean Dupont",
          },
          amount: {
            type: "number",
            example: 100.00,
          },
          isPaid: {
            type: "boolean",
            example: false,
          },
          notes: {
            type: "string",
            nullable: true,
            example: "Prêt pour l'anniversaire",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Discussion: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          userId: {
            type: "string",
            example: "clx1234567890",
          },
          status: {
            type: "string",
            enum: ["OPEN", "CLOSED", "ARCHIVED"],
            example: "OPEN",
          },
          lastActivityAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
          user: {
            $ref: "#/components/schemas/User",
          },
          messages: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Message",
            },
          },
          _count: {
            type: "object",
            properties: {
              messages: {
                type: "number",
                example: 5,
              },
            },
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "clx1234567890",
          },
          discussionId: {
            type: "string",
            example: "clx1234567890",
          },
          senderId: {
            type: "string",
            nullable: true,
            example: "clx1234567890",
            description: "null si envoyé par un admin",
          },
          senderType: {
            type: "string",
            enum: ["USER", "ADMIN"],
            example: "USER",
          },
          content: {
            type: "string",
            example: "Bonjour, j'ai besoin d'aide avec mon abonnement",
            maxLength: 5000,
          },
          read: {
            type: "boolean",
            example: false,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-18T12:00:00.000Z",
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Non authentifié - Token JWT manquant ou invalide",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                message: "Authentification requise",
                code: "UNAUTHORIZED",
              },
            },
          },
        },
      },
      PremiumRequiredError: {
        description: "Fonctionnalité premium - Abonnement requis",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                message: "Fonctionnalité premium - Abonnement requis",
                code: "PREMIUM_REQUIRED",
              },
            },
          },
        },
      },
      NotFoundError: {
        description: "Ressource non trouvée",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                message: "Ressource non trouvée",
                code: "NOT_FOUND",
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Health",
      description: "Endpoints de santé de l'API",
    },
    {
      name: "Authentication",
      description: "Authentification par OTP et OAuth",
    },
    {
      name: "Profile",
      description: "Gestion du profil utilisateur",
    },
    {
      name: "Categories",
      description: "Gestion des catégories de transactions",
    },
    {
      name: "Transactions",
      description: "Gestion des transactions (revenus et dépenses)",
    },
    {
      name: "Statistics",
      description: "Statistiques sur les transactions",
    },
    {
      name: "Subscriptions",
      description: "Gestion des abonnements premium",
    },
    {
      name: "Debts",
      description: "Gestion des dettes (fonctionnalité premium)",
    },
    {
      name: "Admin",
      description: "Fonctionnalités administrateur (nécessite le rôle ADMIN)",
    },
    {
      name: "Discussions",
      description: "Système de discussion de support client avec WebSocket en temps réel. Les discussions sont automatiquement supprimées après 25 minutes d'inactivité.",
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

