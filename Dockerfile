# JobberAI frontend — Next 16 in standalone mode.
#
# Node 22 to match the development machine.

# ── deps ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle by `next build`. That makes
# the API URL a BUILD argument, not a runtime environment variable — setting
# it in compose `environment:` would do exactly nothing, and the mistake is
# invisible until a browser tries to reach localhost:8000 in production.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Empty is not "same origin", it is "localhost". lib/config.ts reads
#   process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
# and an empty string is falsy, so a blank build arg silently ships a bundle
# pointing at the developer's laptop. Fail the build instead.
RUN test -n "$NEXT_PUBLIC_API_URL" \
 || (echo "ERROR: --build-arg NEXT_PUBLIC_API_URL is required and must not be empty" && exit 1)

RUN npm run build

# ── runner ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 10001 nodejs && adduser -S -u 10001 -G nodejs nextjs

COPY --from=builder /app/public ./public
# standalone carries server.js and the traced dependencies; static and public
# are not traced and have to come across separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
