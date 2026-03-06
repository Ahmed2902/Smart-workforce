FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

COPY package.json .
COPY tsconfig.base.json .
COPY packages/shared/package.json ./packages/shared/
COPY services/payroll-service/package.json ./services/payroll-service/

RUN npm install --ignore-scripts

COPY packages/shared/ ./packages/shared/
COPY services/payroll-service/tsconfig.json ./services/payroll-service/
COPY services/payroll-service/src/ ./services/payroll-service/src/
COPY services/payroll-service/prisma/ ./services/payroll-service/prisma/

WORKDIR /app/services/payroll-service

RUN npx prisma generate
RUN npm run build

EXPOSE 3005

CMD ["npm", "start"]
