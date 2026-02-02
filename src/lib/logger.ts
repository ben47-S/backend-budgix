/**
 * Configuration du système de logging avec Winston
 * 
 * Fournit un logger structuré avec différents niveaux de log
 * et des formats adaptés selon l'environnement (développement/production)
 */

import winston from "winston";

// Déterminer le niveau de log selon l'environnement
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

// Format personnalisé pour le développement (plus verbeux)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Format pour la production (JSON structuré)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Créer le logger
const logger = winston.createLogger({
  level: logLevel,
  format: process.env.NODE_ENV === "production" ? productionFormat : developmentFormat,
  defaultMeta: {
    service: "budgix-backend",
  },
  transports: [
    // Écrire tous les logs dans la console
    new winston.transports.Console({
      stderrLevels: ["error"],
    }),
    
    // En production, écrire aussi dans un fichier
    ...(process.env.NODE_ENV === "production"
      ? [
          // Fichier pour les erreurs uniquement
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          // Fichier pour tous les logs
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
  
  // Gérer les exceptions non capturées
  exceptionHandlers: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production" ? productionFormat : developmentFormat,
    }),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: "logs/exceptions.log",
          }),
        ]
      : []),
  ],
  
  // Gérer les rejets de promesses non gérés
  rejectionHandlers: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production" ? productionFormat : developmentFormat,
    }),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: "logs/rejections.log",
          }),
        ]
      : []),
  ],
});

// Interface pour les méthodes de logging
export interface Logger {
  error: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  info: (message: string, ...meta: any[]) => void;
  http: (message: string, ...meta: any[]) => void;
  verbose: (message: string, ...meta: any[]) => void;
  debug: (message: string, ...meta: any[]) => void;
  silly: (message: string, ...meta: any[]) => void;
}

// Exporter le logger
export default logger;

// Export des méthodes pour faciliter l'utilisation
export const log = {
  error: (message: string, ...meta: any[]) => logger.error(message, ...meta),
  warn: (message: string, ...meta: any[]) => logger.warn(message, ...meta),
  info: (message: string, ...meta: any[]) => logger.info(message, ...meta),
  http: (message: string, ...meta: any[]) => logger.http(message, ...meta),
  verbose: (message: string, ...meta: any[]) => logger.verbose(message, ...meta),
  debug: (message: string, ...meta: any[]) => logger.debug(message, ...meta),
  silly: (message: string, ...meta: any[]) => logger.silly(message, ...meta),
};

