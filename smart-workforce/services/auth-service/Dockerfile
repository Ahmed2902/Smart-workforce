FROM node:20-alpine
WORKDIR /app

# Copy service package.json first
COPY services/auth-service/package.json ./package.json
COPY services/auth-service/package-lock.json* ./package-lock.json

# Copy the local shared package into the image (adjust path)
COPY packages/shared ./node_modules/@swma/shared

RUN npm install --production

COPY services/auth-service . 

CMD ["node", "dist/server.js"]
