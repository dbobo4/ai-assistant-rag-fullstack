# 1) Use a lightweight Node.js image
FROM node:20-alpine AS base

# 2) Set the working directory inside the container
WORKDIR /app

# 3) Copy package.json + lockfile first (important for caching)
COPY package.json pnpm-lock.yaml ./

# 4) Install pnpm globally
# - Installs pnpm so we can use it to install project dependencies
RUN npm install -g pnpm

# 5) Install dependencies (frozen lockfile for reproducible builds)
RUN pnpm install --frozen-lockfile

# 6) Copy the entire source code
COPY . .

# 7) Build the Next.js application
# - FONT ISSUE already solved (fonts in /public/fonts)
# - No external Google Fonts download is required
# - IMPORTANT: skip environment validation at build time
#   (DATABASE_URL is not available during docker build)
ENV SKIP_ENV_VALIDATION=true
RUN pnpm build

# 8) Expose the default Next.js port
EXPOSE 3000

# 9) Startup command: run migrations first, then start the app
# ------------------------------------------------------------
# This ensures that when the container starts:
#  1. "pnpm db:migrate" is executed:
#     - Runs the lib/db/migrate.ts script
#     - Drizzle ORM checks the migrations/ folder
#     - Applies any pending SQL migration files to the Postgres database
#     - Ensures the DB schema is always in sync with schema.ts
#
#  2. If migrations succeed, the Next.js server is launched:
#     - "pnpm start" serves the prebuilt .next production code
#     - The app now connects to a DB guaranteed to have the correct schema
#
# IMPORTANT:
# - Build phase skips env validation (SKIP_ENV_VALIDATION=true)
# - Runtime phase WILL validate env (must provide DATABASE_URL)
# - Idempotent: if all migrations have already been applied,
#   db:migrate finishes quickly and makes no changes.
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
