// lib/db.ts — exports a single shared Prisma client instance.
//
// WHY a singleton? Prisma opens a connection pool to PostgreSQL.
// In development, Next.js hot-reloads your code on every save, which would
// create a new pool on each reload and quickly exhaust database connections.
// The pattern below reuses a single instance by stashing it on `globalThis`
// (a global object that survives hot-reloads in the Node.js process).
// In production there's only one startup, so the singleton is just good hygiene.

import { PrismaClient } from "@/app/generated/prisma/client";

// Extend the global type so TypeScript doesn't complain about `globalThis.prisma`.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"], // logs every SQL query to the console in development — helpful for learning
  });

if (process.env.NODE_ENV !== "production") {
  // Only stash on globalThis outside of production.
  // In production (Vercel) each serverless function is a fresh process anyway.
  globalForPrisma.prisma = db;
}
