import 'dotenv/config';
import app from './app.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import config from './config/config.js';

async function startServer() {
  await connectDB(config.MONGO_URI);
  const server = app.listen(config.PORT, () => process.stdout.write(`DevTrack API listening on port ${config.PORT}\n`));
  const shutdown = () => server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
startServer().catch(() => {
  process.stderr.write('Server failed to start. Check configuration and database availability.\n');
  process.exit(1);
});
