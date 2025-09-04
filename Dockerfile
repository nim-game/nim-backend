# ---- Build Stage ----
FROM node:22-alpine AS build
WORKDIR /app

# nur package.json / lockfile zuerst, für Layer-Caching
COPY package*.json ./
RUN npm install

# dann Quellcode rein
COPY . .

# TypeScript → JS
RUN npm run build

# ---- Runtime Stage ----
FROM node:22-alpine
WORKDIR /app

# nur runtime files kopieren
COPY package*.json ./
RUN npm install --omit=dev

# dist aus build-stage kopieren
COPY --from=build /app/dist ./dist

EXPOSE 8000
ENTRYPOINT ["node", "--enable-source-maps", "dist/server.js"]
