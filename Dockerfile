# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN npm i -g pnpm@latest

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 \
    DATA_DIR=/data SEED_DIR=/app/data/lists \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
# Python + the open-source (unofficial) garminconnect library, used only by the optional "Garmin Connect login" import source.
# (garminconnect needs Python >= 3.12; Debian's is older, so uv fetches a standalone build.)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN UV_PYTHON_INSTALL_DIR=/opt/python uv venv /opt/garmin --python 3.13 \
 && VIRTUAL_ENV=/opt/garmin uv pip install --no-cache "garminconnect>=0.3.20" \
 && chmod -R a+rX /opt/python /opt/garmin
ENV GARMIN_BRIDGE_PYTHON=/opt/garmin/bin/python3
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --chown=node:node scripts/garmin_bridge.py ./scripts/garmin_bridge.py
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data/lists ./data/lists
COPY --from=build --chown=node:node /app/data/networks ./data/networks
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
