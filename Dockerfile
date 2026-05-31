# =============================================================================
# Dockerfile — SPO (Sistema Pimenta Ousada)
# Multi-stage: deps -> builder -> runner
# Requer next.config.mjs com output: 'standalone'
# =============================================================================

# ---- Estagio 1: Instalar dependencias --------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# openssl necessario para Prisma no Alpine (OpenSSL 3.x)
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ---- Estagio 2: Build de producao ------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# openssl necessario para Prisma gerar client e rodar durante o build
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar Prisma Client (binaryTargets inclui linux-musl-openssl-3.0.x — ver schema.prisma)
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build gera .next/standalone com tudo que precisa para rodar
RUN npm run build

# ---- Estagio 3: Imagem final (runner) minima --------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# openssl necessario para Prisma em runtime (migrate deploy + query engine)
RUN apk add --no-cache openssl

# Usuario nao-root por seguranca
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Saida do build standalone (server.js + node_modules minimos)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema e migrations do Prisma (necessario para migrate deploy em runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma Client gerado (engines para linux-musl-openssl-3.0.x)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI (necessario para rodar migrate deploy no entrypoint)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Diretorio para o banco SQLite (sera montado como volume)
RUN mkdir -p /data && chown nextjs:nodejs /data

# Entrypoint: roda migrate deploy e depois inicia o servidor
# sed remove \r (CRLF) caso o arquivo tenha sido salvo no Windows
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
