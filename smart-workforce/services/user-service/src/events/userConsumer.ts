import { getChannel, connectRabbit } from './rabbit';
import { handleUserRegistered } from '../services/userEventService';

const EXCHANGE = 'user';
const ROUTING_KEY = 'user.created';
const QUEUE = 'user_events';

export const consumeUserEvents = async () => {
  let channel;
  try {
    channel = getChannel();
  } catch (err) {
    console.warn(
      '[User Consumer] Channel not initialized, attempting to connect...',
    );
    await connectRabbit();
    channel = getChannel();
  }
  // limit unacked messages
  try {
    channel.prefetch && channel.prefetch(10);
  } catch (e) {
    // ignore if not supported
  }
  console.log(
    `[User Consumer] Subscribing to exchange='${EXCHANGE}' routing='${ROUTING_KEY}' queue='${QUEUE}'`,
  );
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  console.log('[User Consumer] Queue bound, starting consumer...');

  channel.consume(QUEUE, async (msg: any) => {
    if (!msg) return;

    try {
      const raw = msg.content.toString();
      console.log('[User Consumer] Raw message:', raw);
      const event = JSON.parse(raw);
      console.log('[User Consumer] Parsed event:', event);

      if (event.type === 'UserRegistered') {
        const data = event.data;
        if (!data?.authUserId) {
          console.warn(
            'Skipping UserRegistered event because authUserId is missing',
            data,
          );
        } else {
          await handleUserRegistered(data);
          console.log(`User ${data.email} processed (registration event).`);
        }
      }

      channel.ack(msg);
    } catch (err) {
      console.error('Failed to process event:', err);
      channel.nack(msg, false, true); // requeue
    }
  });
};
