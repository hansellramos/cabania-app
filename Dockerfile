FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies (Vue/Vite + Prisma)
COPY package.json package-lock.json ./
RUN npm ci

# Install server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy source files
COPY . .

# Build args for Vite (baked into the SPA at build time)
ARG VITE_MAPBOX_ACCESS_TOKEN
ARG VITE_APP_URL=https://cabania.app
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN
ENV VITE_APP_URL=$VITE_APP_URL

# Generate Prisma client + build Vue SPA
RUN npm run build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Copy built SPA
COPY --from=builder /app/dist ./dist

# Copy server + node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "server/index.js"]
