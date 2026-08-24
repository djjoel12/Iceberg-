# Multi-stage Dockerfile to run Next.js frontend and FastAPI backend in one container
# Stage 1: build the Next.js app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install deps
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: final image with Node + Python + nginx
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install python, pip, and nginx
RUN apt-get update \
  && apt-get install -y python3 python3-pip nginx ca-certificates curl gnupg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

# Copy built frontend from builder
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/node_modules node_modules

# Copy backend
COPY backend backend
COPY backend/requirements.txt backend/requirements.txt

# Install backend Python requirements
RUN pip3 install --no-cache-dir -r backend/requirements.txt

# Copy nginx config and start script
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
