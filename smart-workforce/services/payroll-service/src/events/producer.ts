import { getChannel, EXCHANGE_NAME } from './rabbit';

const publish = async (routingKey: string, event: any) => {
  const channel = getChannel();
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
};

export const publishPayrollCreated = async (payroll: any) => {
  await publish('payroll.created', {
    type: 'PayrollCreated',
    data: payroll,
    timestamp: new Date().toISOString(),
  });
};

export const publishPayrollCalculated = async (payroll: any) => {
  await publish('payroll.calculated', {
    type: 'PayrollCalculated',
    data: payroll,
    timestamp: new Date().toISOString(),
  });
};

export const publishPayrollApproved = async (payroll: any) => {
  await publish('payroll.approved', {
    type: 'PayrollApproved',
    data: payroll,
    timestamp: new Date().toISOString(),
  });
};

export const publishPayrollDeleted = async (payload: {
  id: string;
  employeeId: string;
  period: string;
}) => {
  await publish('payroll.deleted', {
    type: 'PayrollDeleted',
    data: payload,
    timestamp: new Date().toISOString(),
  });
};
