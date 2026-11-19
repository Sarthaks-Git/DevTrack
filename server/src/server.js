import 'dotenv/config';
import app from './app.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import config from './config/config.js';
import { startReminderEmailSchedule } from './services/reminderEmail.service.js';
import { describeUnexpectedError } from './middlewares/error.middleware.js';

// Last-resort handlers for errors outside any request (timers, background work). Same rule as the
// HTTP error handler: log where it happened, never the message.
process.on('unhandledRejection', reason => {
  process.stderr.write(`Unhandled promise rejection: ${describeUnexpectedError(reason)}\n`);
});
process.on('uncaughtException', error => {
  process.stderr.write(`Uncaught exception, restarting: ${describeUnexpectedError(error)}\n`);
  // State may be corrupt after an uncaught exception; exit and let the host restart the service.
  process.exit(1);
});

async function startServer() {
  await connectDB(config.MONGO_URI);
  const server = app.listen(config.PORT, () => process.stdout.write(`DevTrack API listening on port ${config.PORT}\n`));
  const stopReminderEmails = startReminderEmailSchedule();
  const shutdown = () => server.close(async () => {
    stopReminderEmails();
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
