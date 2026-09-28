# Base image with Node.js 20 and Python 3
FROM node:20-bookworm-slim AS base

# Install Python 3 and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Node dependencies
COPY package*.json ./
RUN npm ci

# 2. Setup Python environment for ML
COPY ml/requirements.txt ./ml/requirements.txt
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r ./ml/requirements.txt || true

# 3. Copy source code and build TypeScript
COPY . .
RUN npm run build

# 4. Set environment
ENV NODE_ENV=production
ENV PORT=5000
ENV PATH="/app/venv/bin:$PATH"

EXPOSE 5000

# Persist SQLite databases
VOLUME ["/app/data"]

CMD ["npm", "start"]