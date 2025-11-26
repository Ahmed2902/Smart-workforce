import { app } from './app';
import { connectRabbit } from './events/rabbit';
import { config } from './config/env';
import { consumeExternalEvents } from './events/consumer';

const PORT = config.port || 4002;

async function start() {
  try {
    await connectRabbit();
    await consumeExternalEvents();
    app.listen(PORT, () => {
      console.log(`🚀 Schedule service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start service:', err);
    process.exit(1);
  }
}

start();
