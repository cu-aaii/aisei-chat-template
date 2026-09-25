# Base images come from the ECR Public Gallery, not bare Docker Hub refs: CodeBuild
# builds from a shared NAT IP and `docker build --pull` otherwise trips Docker Hub's
# anonymous pull rate limit.

# ---- Build stage ----
FROM public.ecr.aws/docker/library/node:24-alpine AS build

WORKDIR /app

# Install dependencies (layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune to production deps only
RUN npm prune --omit=dev

# ---- Production stage ----
# Named `app` so a deploy pipeline can build it with `docker build --target app`.
FROM public.ecr.aws/docker/library/node:24-alpine AS app

WORKDIR /app

ENV NODE_ENV=production
# Container port. Whatever runs the image (a load balancer, `docker run -p`) must point
# at 8000. Local dev keeps using 4318; the two are independent.
ENV PORT=8000

# Copy only what's needed to run
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

USER node

EXPOSE 8000

CMD ["node", "dist/server/index.js"]
