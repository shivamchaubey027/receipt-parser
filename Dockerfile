# ── Build Frontend ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Build Backend ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build-backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# We run TSX dynamically in dev, but for prod we should ideally transpile.
# For simplicity in this demo container, we'll run it directly using tsx,
# or if you prefer a compiled run, add tsc steps here.

# ── Production Image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Ensure curl is installed for heathchecks or IP tunnels if needed
RUN apk add --no-cache curl

# Bundle frontend
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Bundle backend
WORKDIR /app/backend
COPY --from=build-backend /app/backend/node_modules ./node_modules
COPY backend/ ./

# Expose backend port
EXPOSE 3001

# Run the backend server
# Note: For this demo, we run the backend natively and it will need to be configured
# to serve the static frontend/dist files (see instructions).
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/server.ts"]
