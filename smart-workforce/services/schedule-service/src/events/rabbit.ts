import * as amqp from 'amqplib';

let channel: any;
let connection: any;

export const EXCHANGE_NAME = 'schedule';

export const connectRabbit = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  console.log(`[Schedule Service] connecting to RabbitMQ at ${url}`);
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  console.log(
    '[Schedule Service] Connected to RabbitMQ and asserted exchange',
    EXCHANGE_NAME,
  );

  connection.on('error', (err: any) =>
    console.error('[Schedule Service] Rabbit connection error', err),
  );
  connection.on('close', () =>
    console.warn('[Schedule Service] Rabbit connection closed'),
  );
};

// Simple helper to publish schedule events (will also be wrapped in producer.ts)
export const publishScheduleEvent = async (routingKey: string, event: any) => {
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(
    `[Schedule Service] Published event ${routingKey} to exchange '${EXCHANGE_NAME}'`,
    event,
  );
};

export const getChannel = () => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
};
