FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm i -g serve@14
COPY --from=build /app/dist /app/dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]

