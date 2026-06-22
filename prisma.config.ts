/// <reference types="node" />
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load from .env.local (Next.js convention) instead of dotenv's default .env
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI operations (db push, migrate) use the direct Postgres connection.
    // Supabase's transaction pooler (port 6543) does not support advisory locks
    // required by Prisma schema operations — use the direct URL (port 5432) here.
    // The app runtime (PrismaClient in lib/db.ts) uses DATABASE_URL (pooler).
    url: process.env["DIRECT_URL"],
  },
});