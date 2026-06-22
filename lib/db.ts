// Phase 2: Uncomment after running:
//   npm install dotenv              (if not already installed)
//   npx prisma generate             (generates typed client at generated/prisma/)
//   npx prisma migrate dev          (applies schema to Supabase via prisma.config.ts)
//
// Prisma 7 generates the client at generated/prisma/ (not @prisma/client).
// DATABASE_URL is read from .env.local by Next.js at runtime; prisma.config.ts
// reads it for CLI commands (migrate, db push).
//
// import { PrismaClient } from "@/generated/prisma"
//
// declare global {
//   // eslint-disable-next-line no-var
//   var prisma: PrismaClient | undefined
// }
//
// export const prisma = global.prisma ?? new PrismaClient()
//
// if (process.env.NODE_ENV !== "production") global.prisma = prisma

export {};