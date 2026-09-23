FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy compiled backend bundle and static frontend build with correct ownership
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/assets ./assets

# Create the tmp directory and assign ownership to the node user
RUN mkdir -p /app/tmp && chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]