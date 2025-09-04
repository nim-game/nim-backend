FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY . .
ENTRYPOINT ["node", "--enable-source-maps", "dist/main.js"]
