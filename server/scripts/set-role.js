// Owner-only: set a user's role from the server shell. There is deliberately no web route for this.
// Usage: npm run role:set -- <username> admin
//        npm run role:set -- <username> user     back to a normal account
import mongoose from 'mongoose';
import config from '../src/config/config.js';
import { connectDB } from '../src/config/db.js';
import { setUserRoleLogic } from '../src/services/userRole.service.js';

const [username, role] = process.argv.slice(2);

async function main() {
  if (!username || !role) throw new Error('Usage: npm run role:set -- <username> <user|admin>');

  await connectDB(config.MONGO_URI);
  const result = await setUserRoleLogic({ username, role });
  // The database name (never the connection string) shows which database was changed.
  process.stdout.write(`Role for ${result.username} is now ${result.role} (database: ${mongoose.connection.name}).\n`);
}

main()
  .catch(error => {
    process.stderr.write(`Could not set the role: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
