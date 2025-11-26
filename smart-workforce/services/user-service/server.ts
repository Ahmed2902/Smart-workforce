import app from './src/app';
import { connectRabbit } from './src/events/rabbit';
import { consumeUserEvents } from './src/events/userConsumer';

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await connectRabbit();
    await consumeUserEvents();

    app.listen(PORT, () => {
      console.log(`🚀 User service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start User service:', err);
    process.exit(1);
  }
})();
