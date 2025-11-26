FROM node:20-alpine

WORKDIR /app

# First, copy only package.json files
COPY package.json .
COPY tsconfig.base.json .
COPY packages/shared/package.json ./packages/shared/
COPY services/schedule-service/package.json ./services/schedule-service/

# Install dependencies at the root
RUN npm install

# Copy the rest of the files
COPY packages/shared/ ./packages/shared/
COPY services/schedule-service/tsconfig.json ./services/schedule-service/
COPY services/schedule-service/src/ ./services/schedule-service/src/
COPY services/schedule-service/prisma/ ./services/schedule-service/prisma/

# Move to service directory and build
WORKDIR /app/services/schedule-service

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

EXPOSE 3003

# Make sure we're in the right directory when running the command
CMD ["npm", "start"]
