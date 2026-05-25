# =============================================================================
# Dockerfile — SPO (Sistema Pimenta Ousada)
# Multi-stage build: builder (compilação) + runner (produção mínima)
# ADR-004: Docker como padrão de distribuição desde o MVP
# =============================================================================

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifests primeiro (cache de dependências — rebuild só se package.json mudar)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências (incluindo devDependencies para o build)
RUN npm ci

# Gerar Prisma Client (requer schema.prisma copiado acima)
RUN npx prisma generate

# Copiar o restante do código
COPY . .

# Build Next.js com output standalone
RUN npm run build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Porta padrão do Next.js
ENV PORT=3000
# Hostname necessário para Next.js standalone em container
ENV HOSTNAME="0.0.0.0"

# Criar usuário não-root (boas práticas de segurança)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar artefatos do build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copiar Prisma (schema + migration para prisma migrate deploy no entrypoint)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script (migrate + seed + start)
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Volume para o banco SQLite — criado aqui para garantir ownership correto
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
