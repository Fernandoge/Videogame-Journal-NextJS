// auth.ts — the single source of truth for NextAuth configuration.
//
// NextAuth v5 exports four things from this file that you use throughout the app:
//   handlers — the GET/POST functions that power the /api/auth/* routes
//   auth      — call this in Server Components to get the current session
//   signIn    — call this in Server Actions to trigger a sign-in redirect
//   signOut   — call this in Server Actions to sign the user out

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The Prisma adapter tells NextAuth to store users and accounts in our
  // PostgreSQL database. When someone signs in with Google for the first time,
  // NextAuth automatically creates a User row and an Account row.
  adapter: PrismaAdapter(db),

  providers: [
    // Google reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from .env automatically.
    // No need to pass them explicitly here.
    Google,
  ],

  session: {
    // "jwt" means session data is stored in an encrypted cookie, NOT in the
    // database. This avoids needing a separate Session table and sidesteps
    // the naming conflict with our PlaySession model.
    strategy: "jwt",
  },

  pages: {
    // Point NextAuth at our custom sign-in page instead of its built-in one.
    // Any unauthenticated request that NextAuth would redirect to /api/auth/signin
    // will go to /signin instead, where we control the design.
    signIn: "/signin",
  },

  callbacks: {
    // The jwt callback runs every time a JWT is created or updated.
    // We add the user's database ID to the token so we can access it
    // in Server Components via the session.
    async jwt({ token, user }) {
      if (user) {
        // `user` is only present on the very first sign-in.
        // We grab the DB id and attach it to the token.
        token.id = user.id;
      }
      return token;
    },

    // The session callback shapes what `auth()` returns in your components.
    // By default the session doesn't include the user's DB id — we add it here.
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
