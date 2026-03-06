import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || '3003',
  dbUrl: process.env.DATABASE_URL!,
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
};
