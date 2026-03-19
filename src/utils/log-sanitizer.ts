/**
 * Utilitaires de sanitization pour les logs
 * Empêche l'exposition de données sensibles dans les logs de production
 */

/**
 * Liste des champs sensibles à ne jamais logger
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'code', // OTP codes
  'otp',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
];

/**
 * Sanitize un objet pour les logs en retirant les champs sensibles
 *
 * @param data - Objet à sanitizer
 * @returns Objet sanitizé
 *
 * @example
 * ```typescript
 * const body = { email: "user@example.com", password: "secret123" };
 * const safe = sanitizeForLog(body);
 * // { email: "user@example.com", password: "[REDACTED]" }
 * ```
 */
export function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Vérifier si le champ est sensible
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Récursif pour les objets imbriqués
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Masque un token en ne montrant que les premiers et derniers caractères
 *
 * @param token - Token à masquer
 * @param visibleChars - Nombre de caractères visibles de chaque côté (défaut: 4)
 * @returns Token masqué
 *
 * @example
 * ```typescript
 * maskToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"); // "eyJh...VCJ9"
 * ```
 */
export function maskToken(token?: string, visibleChars: number = 4): string {
  if (!token) return '[NO_TOKEN]';
  if (token.length <= visibleChars * 2) return '[TOKEN_TOO_SHORT]';

  const start = token.slice(0, visibleChars);
  const end = token.slice(-visibleChars);
  return `${start}...${end}`;
}

/**
 * Masque un numéro de téléphone
 *
 * @param phone - Numéro de téléphone à masquer
 * @returns Numéro masqué
 *
 * @example
 * ```typescript
 * maskPhone("+225 07 12 34 56 78"); // "+225 07 12 ** ** 78"
 * maskPhone("0712345678"); // "0712****78"
 * ```
 */
export function maskPhone(phone: string): string {
  if (!phone) return '[NO_PHONE]';

  // Garder les 4 premiers et 2 derniers chiffres
  const cleaned = phone.replace(/\D/g, ''); // Retirer non-chiffres

  if (cleaned.length < 6) return '****';

  const start = cleaned.slice(0, 4);
  const end = cleaned.slice(-2);
  const masked = start + '****' + end;

  return masked;
}

/**
 * Masque un email en cachant une partie du nom d'utilisateur
 *
 * @param email - Email à masquer
 * @returns Email masqué
 *
 * @example
 * ```typescript
 * maskEmail("john.doe@example.com"); // "jo****e@example.com"
 * ```
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '[INVALID_EMAIL]';

  const [username, domain] = email.split('@');

  if (username.length <= 2) {
    return `**@${domain}`;
  }

  const start = username.slice(0, 2);
  const end = username.slice(-1);
  const masked = `${start}****${end}@${domain}`;

  return masked;
}

/**
 * Sanitize les headers de requête HTTP en retirant les tokens
 *
 * @param headers - Headers de la requête
 * @returns Headers sanitizés
 */
export function sanitizeHeaders(headers: any): any {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Masquer les headers d'authentification
    if (lowerKey === 'authorization') {
      sanitized[key] = typeof value === 'string' && value.startsWith('Bearer ')
        ? `Bearer ${maskToken(value.replace('Bearer ', ''))}`
        : '[REDACTED]';
    } else if (lowerKey.includes('token') || lowerKey.includes('key')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Crée un objet de log sécurisé pour une requête HTTP
 *
 * @param req - Objet de requête Express
 * @returns Objet de log sécurisé
 *
 * @example
 * ```typescript
 * console.log("[API]", createSafeLogObject(req));
 * ```
 */
export function createSafeLogObject(req: any): any {
  return {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'],
    body: sanitizeForLog(req.body),
    query: sanitizeForLog(req.query),
    // Ne PAS inclure req.headers complet
  };
}

/**
 * Log seulement en développement
 *
 * @param message - Message à logger
 * @param data - Données à logger (optionnel)
 *
 * @example
 * ```typescript
 * devLog("User created", { userId: user.id });
 * ```
 */
export function devLog(message: string, data?: any): void {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(`[DEV] ${message}`, sanitizeForLog(data));
    } else {
      console.log(`[DEV] ${message}`);
    }
  }
}
