# Multi-stage image for the React/Vite frontend.
#
#   docker build --target dev  -t mds-frontend:dev  ./frontend
#   docker build --target prod -t mds-frontend:prod ./frontend
#
# `dev` runs the Vite dev server (docker-compose). `prod` builds the
# static bundle and serves it with nginx — but the canonical production
# path is uploading `dist/` to the CDN/static host (docs/DEPLOYMENT.md);
# this image is the self-hosted fallback.

# ---------- deps ----------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- dev ----------
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- build ----------
FROM deps AS build
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_SITE_ORIGIN
RUN npm run build

# ---------- prod (nginx) ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
