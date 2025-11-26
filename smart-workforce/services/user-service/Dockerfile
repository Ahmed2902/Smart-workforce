FROM node:20-alpine

WORKDIR /app

# First, copy only package.json files
COPY package.json .
COPY tsconfig.base.json .
COPY packages/shared/package.json ./packages/shared/
COPY services/user-service/package.json ./services/user-service/

# Install dependencies at the root
RUN npm install

# Copy the rest of the files
COPY packages/shared/ ./packages/shared/
COPY services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/src/ ./services/user-service/src/
COPY services/user-service/prisma/ ./services/user-service/prisma/

# Move to service directory and build
WORKDIR /app/services/user-service

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Make sure we're in the right directory when running the command
CMD ["npm", "start"]
