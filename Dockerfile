FROM node:20-alpine

WORKDIR /app

# Fix for better-sqlite3 build on alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./
COPY public/ ./public/
COPY database.json ./

EXPOSE 3003
CMD ["node", "server.js"]
