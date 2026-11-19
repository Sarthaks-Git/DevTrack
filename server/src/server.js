import 'dotenv/config';
import app from './app.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import config from './config/config.js';
import { startReminderEmailSchedule } from './services/reminderEmail.service.js';
import { describeUnexpectedError } from './middlewares/error.middleware.js';
import { alertOwner } from './services/errorAlert.service.js';

// Last-resort handlers for errors outside any request (timers, background work). Same rule as the
// HTTP error handler: log where it happened, never the message.
process.on('unhandledRejection', reason => {
  const detail = describeUnexpectedError(reason);
  process.stderr.write(`Unhandled promise rejection: ${detail}\n`);
  alertOwner('rejection', detail);
});
process.on('uncaughtException', error => {
  const detail = describeUnexpectedError(error);
  process.stderr.write(`Uncaught exception, restarting: ${detail}\n`);
  // State may be corrupt after an uncaught exception: give the alert a few seconds, then exit and
  // let the host restart the service.
  const exit = () => process.exit(1);
  setTimeout(exit, 3000).unref();
  alertOwner('uncaught', detail).finally(exit);
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
