import amqp, { Channel, Connection } from 'amqplib';

let channel: Channel | any;
let connection: Connection | any;

const EXCHANGE_NAME = 'user';

/**
 * Connects to RabbitMQ and returns a channel.
 */
export const connectRabbit = async (): Promise<Channel> => {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  connection = await amqp.connect(url);
  const ch = await connection.createChannel();

  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  channel = ch;
  console.log(`🐇 RabbitMQ connected. Exchange: ${EXCHANGE_NAME}`);

  return channel;
};

/**
 * Publishes a message to the auth exchange.
 */
export const publishAuthUserCreated = async (user: any) => {
  if (!channel) {
    console.warn('Rabbit channel not initialized, attempting to connect...');
    try {
      await connectRabbit();
    } catch (err) {
      console.error('Failed to initialize RabbitMQ channel for publish', err);
      throw err;
    }
  }

  const event = {
    type: 'UserRegistered',
    data: {
      authUserId: user.id,
      email: user.email,
      role: user.role ?? 'EMPLOYEE',
      name: user.name,
      phone: user.phone,
    },
    timestamp: new Date().toISOString(),
  };
  try {
    channel.publish(
      EXCHANGE_NAME,
      'user.created',
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: 'application/json',
      },
    );
    console.log(
      `📤 Event published: ${event.type} -> ${EXCHANGE_NAME}:user.created`,
      event,
    );
  } catch (err) {
    console.error('Failed to publish event to RabbitMQ', err, event);
    throw err;
  }
};
