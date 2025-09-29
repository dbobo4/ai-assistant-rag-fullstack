import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import "dotenv/config";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // In production this must always be defined,
    // but during Docker build we allow skipping it
    DATABASE_URL: z.string().min(1),
  },
  client: {
    // Example for client-side env vars:
    // NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().min(1),
  },

  // IMPORTANT FIX:
  // --------------------------------------------------------------------
  // By default, @t3-oss/env-nextjs validates all required env variables
  // during build (e.g. DATABASE_URL must be set).
  // In Docker, this caused the build to fail because DATABASE_URL is only
  // injected at runtime (via docker-compose.yml).
  //
  // The `skipValidation` flag solves this:
  // - When SKIP_ENV_VALIDATION=true, validation is skipped during build.
  // - At runtime (when starting the container), DATABASE_URL is required
  //   and must be present, otherwise the app will crash.
  //
  // This way:
  // Build no longer fails in Docker
  // Runtime still enforces proper env variables
  // --------------------------------------------------------------------
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  // For Next.js >= 13.4.4, client vars go here
  experimental__runtimeEnv: {
    // NEXT_PUBLIC_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PUBLISHABLE_KEY,
  },
});
