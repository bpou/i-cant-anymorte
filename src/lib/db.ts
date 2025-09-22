// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // Gör att vi slipper skapa flera instanser i dev (Next.js hot-reload)
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // loggar kan tas bort i produktion
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
