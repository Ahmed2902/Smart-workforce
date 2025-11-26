FROM node:20-alpine

WORKDIR /app

# First, copy only package.json files
COPY package.json .
COPY tsconfig.base.json .
COPY packages/shared/package.json ./packages/shared/
COPY services/auth-service/package.json ./services/auth-service/

# Install dependencies at the root
RUN npm install

# Copy the rest of the files
COPY packages/shared/ ./packages/shared/
COPY services/auth-service/tsconfig.json ./services/auth-service/
COPY services/auth-service/src/ ./services/auth-service/src/
COPY services/auth-service/prisma/ ./services/auth-service/prisma/

# Move to service directory and build
WORKDIR /app/services/auth-service

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

# Make sure we're in the right directory when running the command
CMD ["npm", "start"]
