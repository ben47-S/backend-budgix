import type { PassportStatic } from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { prisma } from "../lib/prisma.js";
import logger from "../lib/logger.js";

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

function getGoogleOAuthConfig() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    logger.error(
      "[OAuth] Configuration Google OAuth manquante. GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non défini."
    );
    return null;
  }

  const explicitCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
  const backendUrl = process.env.BACKEND_URL;
  const port = process.env.PORT || "3000";

  const callbackURL =
    explicitCallbackUrl ||
    (backendUrl
      ? `${backendUrl.replace(/\/+$/, "")}/api/auth/oauth/google/callback`
      : `http://localhost:${port}/api/auth/oauth/google/callback`);

  return {
    clientID,
    clientSecret,
    callbackURL,
  };
}

async function findOrCreateUserFromGoogleProfile(
  profile: Profile
): Promise<GoogleAuthUser> {
  const email = profile.emails?.[0]?.value;

  if (!email) {
    throw new Error("Email non trouvé dans le profil Google");
  }

  // Sélection standardisée des champs utilisateur utilisée dans le reste du backend
  const userSelect = {
    id: true,
    phone: true,
    email: true,
    username: true,
    isPremium: true,
    status: true,
    role: true,
    createdAt: true,
  } as const;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: userSelect,
  });

  if (existingUser) {
    return {
      ...existingUser,
      isNewUser: false,
    };
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      username: profile.displayName || null,
      // On laisse Prisma appliquer les valeurs par défaut :
      // - status: PENDING_CONSENT
      // - role: USER
      // - isPremium: false
    },
    select: userSelect,
  });

  return {
    ...createdUser,
    isNewUser: true,
  };
}

export function configurePassport(passport: PassportStatic) {
  const googleConfig = getGoogleOAuthConfig();

  if (!googleConfig) {
    // Ne pas enregistrer la stratégie si la configuration est incomplète
    return;
  }

  const { clientID, clientSecret, callbackURL } = googleConfig;

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUserFromGoogleProfile(profile);

          logger.info("[OAuth] Authentification Google réussie", {
            userId: user.id,
            email: user.email,
            isNewUser: user.isNewUser,
          });

          done(null, user);
        } catch (error: any) {
          logger.error("[OAuth] Erreur lors de l'authentification Google", {
            error: error?.message || error,
          });
          done(error);
        }
      }
    )
  );

  // Même si les sessions Passport ne sont pas utilisées (JWT only),
  // on définit serializeUser/deserializeUser pour respecter l'API standard.
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          phone: true,
          email: true,
          username: true,
          isPremium: true,
          status: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        return done(new Error("Utilisateur non trouvé"), null);
      }

      done(null, { ...user, isNewUser: false });
    } catch (error) {
      done(error as Error);
    }
  });
}

