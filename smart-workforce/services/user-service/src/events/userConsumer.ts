import { getChannel, connectRabbit } from './rabbit';
import { PrismaClient } from '@prisma/client';
import * as producer from './userProducer';

const prisma = new PrismaClient();

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
      console.log('📩 User Service received parsed event:', event);

      if (event.type === 'UserRegistered') {
        const data = event.data;
        if (!data?.authUserId) {
          console.warn(
            'Skipping UserRegistered event because authUserId is missing',
            data,
          );
        } else {
          // Create user and automatically add to default organization
          const user = await prisma.user.upsert({
            where: { authUserId: data.authUserId },
            update: {
              email: data.email,
              name: data.name ?? undefined,
              phone: data.phone ?? undefined,
              systemRole: data.systemRole ?? 'USER',
              role: data.role ?? 'EMPLOYEE',
            },
            create: {
              authUserId: data.authUserId,
              email: data.email,
              name: data.name ?? 'New User',
              phone: data.phone ?? undefined,
              systemRole: data.systemRole ?? 'USER',
              role: data.role ?? 'EMPLOYEE',
            },
          });
          console.log(
            `✅ User ${data.email} upserted into User DB (authUserId=${data.authUserId})`,
          );

          // Find default organization or create one if it doesn't exist
          let defaultOrg = await prisma.organization.findFirst({
            where: { name: 'Default Organization' },
          });

          if (!defaultOrg) {
            defaultOrg = await prisma.organization.create({
              data: {
                name: 'Default Organization',
                description: 'Default organization for all users',
              },
            });
            // Publish organization created event
            await producer.publishOrganizationCreated(defaultOrg);
          }

          // Add user to default organization
          const membership = await prisma.organizationMembership.create({
            data: {
              userId: user.id,
              organizationId: defaultOrg.id,
              role: data.role ?? 'EMPLOYEE',
            },
            include: {
              user: true,
              organization: true,
            },
          });

          // Publish membership event so schedule-service can create the user
          await producer.publishUserMembershipAdded({
            userId: user.id,
            organizationId: defaultOrg.id,
            role: membership.role,
            user: {
              id: user.id,
              authUserId: user.authUserId,
              email: user.email,
              name: user.name,
              systemRole: user.systemRole,
            },
            organization: {
              id: defaultOrg.id,
              name: defaultOrg.name,
            },
          });

          console.log(`✅ User ${data.email} added to default organization`);
        }
      }

      channel.ack(msg);
    } catch (err) {
      console.error('❌ Failed to process event:', err);
      channel.nack(msg, false, true); // requeue
    }
  });
};
