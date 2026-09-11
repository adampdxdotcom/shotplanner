FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled backend bundle and static frontend build
COPY --from=build /app/dist ./dist
COPY --from=build /app/assets ./assets

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
