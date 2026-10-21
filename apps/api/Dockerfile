# Build depuis la racine du monorepo : docker build -f apps/api/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm ci --workspace @dala/api --workspace @dala/shared --include-workspace-root
RUN npm run build -w @dala/shared && npm run build -w @dala/api

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
