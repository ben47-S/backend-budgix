import nodemailer from 'nodemailer';
import logger from '../lib/logger.js';

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true pour 465, false pour les autres ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Vérifie si le service email est configuré
 */
export function isEmailServiceAvailable(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

/**
 * Envoie un email de code de vérification
 * @param email - Email du destinataire
 * @param code - Code de vérification à 6 chiffres
 * @returns Promise<boolean> - true si l'envoi a réussi
 */
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  try {
    // Vérifier si le service est configuré
    if (!isEmailServiceAvailable()) {
      logger.warn('Service email non configuré. Email non envoyé.');
      logger.info(`[DEV] Code de vérification pour ${email}: ${code}`);
      return false;
    }

    // Configuration de l'email
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Budgix" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Code de vérification - Budgix',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .code { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; letter-spacing: 5px; margin: 20px 0; padding: 15px; background-color: #fff; border: 2px dashed #4F46E5; border-radius: 5px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Budgix</h1>
                <p>Vérification de votre adresse email</p>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>Vous avez demandé à ajouter ou modifier votre adresse email sur Budgix.</p>
                <p>Voici votre code de vérification :</p>

                <div class="code">${code}</div>

                <div class="warning">
                  <strong>⚠️ Important :</strong> Ce code expire dans <strong>5 minutes</strong>. Ne le partagez avec personne.
                </div>

                <p>Si vous n'avez pas demandé ce code, ignorez simplement cet email.</p>

                <p>Cordialement,<br>L'équipe Budgix</p>
              </div>
              <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; ${new Date().getFullYear()} Budgix. Tous droits réservés.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Budgix - Vérification de votre adresse email

Bonjour,

Vous avez demandé à ajouter ou modifier votre adresse email sur Budgix.

Votre code de vérification est : ${code}

⚠️ Important : Ce code expire dans 5 minutes. Ne le partagez avec personne.

Si vous n'avez pas demandé ce code, ignorez simplement cet email.

Cordialement,
L'équipe Budgix

---
Cet email a été envoyé automatiquement, merci de ne pas y répondre.
© ${new Date().getFullYear()} Budgix. Tous droits réservés.
      `.trim(),
    };

    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email de vérification envoyé à ${email}`, {
      messageId: info.messageId,
      accepted: info.accepted,
    });

    return true;
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de l\'email de vérification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
    });

    // En développement, on affiche quand même le code
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV] Code de vérification pour ${email}: ${code}`);
    }

    return false;
  }
}

/**
 * Envoie un email générique
 * @param to - Email du destinataire
 * @param subject - Sujet de l'email
 * @param html - Contenu HTML de l'email
 * @param text - Contenu texte de l'email (fallback)
 * @returns Promise<boolean> - true si l'envoi a réussi
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  try {
    if (!isEmailServiceAvailable()) {
      logger.warn('Service email non configuré. Email non envoyé.');
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Budgix" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Supprime les balises HTML si pas de texte fourni
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email envoyé à ${to}`, {
      messageId: info.messageId,
      subject,
    });

    return true;
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de l\'email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to,
      subject,
    });

    return false;
  }
}

/**
 * Vérifie la connexion au serveur SMTP
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!isEmailServiceAvailable()) {
      logger.warn('Service email non configuré');
      return false;
    }

    await transporter.verify();
    logger.info('Connexion SMTP vérifiée avec succès');
    return true;
  } catch (error) {
    logger.error('Erreur de connexion SMTP', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
