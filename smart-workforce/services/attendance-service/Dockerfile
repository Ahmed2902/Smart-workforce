FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

COPY package.json .
COPY tsconfig.base.json .
COPY packages/shared/package.json ./packages/shared/
COPY services/attendance-service/package.json ./services/attendance-service/

RUN npm install --ignore-scripts

COPY packages/shared/ ./packages/shared/
COPY services/attendance-service/tsconfig.json ./services/attendance-service/
COPY services/attendance-service/src/ ./services/attendance-service/src/
COPY services/attendance-service/prisma/ ./services/attendance-service/prisma/

WORKDIR /app/services/attendance-service

RUN npm run build --workspace @swma/shared
RUN npx prisma generate
RUN npm run build

EXPOSE 3004

CMD ["npm", "start"]
