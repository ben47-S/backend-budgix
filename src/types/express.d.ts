import "express";

declare global {
    namespace Express {
        interface User {
            id: string;
            phone?: string | null;
            email?: string | null;
            isPremium: boolean;
            role?: string | null;
            [key: string]: unknown; // allow extra fields from GoogleAuthUser
        }

        interface Request {
            userId?: string;
            user?: User;
        }
    }
}
