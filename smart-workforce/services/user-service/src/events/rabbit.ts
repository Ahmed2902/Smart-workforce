import * as amqp from 'amqplib';

let channel: any;
let connection: any;

export const EXCHANGE_NAME = 'user';

export const connectRabbit = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  console.log(`[User Service] connecting to RabbitMQ at ${url}`);
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  console.log(
    '[User Service] Connected to RabbitMQ and asserted exchange',
    EXCHANGE_NAME,
  );

  connection.on('error', (err: any) =>
    console.error('[User Service] Rabbit connection error', err),
  );
  connection.on('close', () =>
    console.warn('[User Service] Rabbit connection closed'),
  );
};

// Publish event when user is created
export const publishUserCreated = async (user: any) => {
  channel.publish(
    EXCHANGE_NAME,
    'user.created',
    Buffer.from(JSON.stringify(user)),
  );
  console.log('[User Service] Published user.created');
};

export const getChannel = () => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
};
