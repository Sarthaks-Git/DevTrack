import 'dotenv/config';
import mongoose from 'mongoose';
import { beforeAll, afterAll } from 'vitest';

// The suite drops its database. Refuse to run unless it is unmistakably a test database.
function assertSafeTestDatabase(testUri, appUri) {
    if (!testUri) throw new Error('MONGODB_TEST_URI is not defined');
    if (appUri && testUri === appUri) throw new Error('MONGODB_TEST_URI must differ from MONGODB_URI');
    const dbName = new URL(testUri).pathname.replace(/^\//, '');
    if (!/test/i.test(dbName)) throw new Error('MONGODB_TEST_URI must name a database containing "test"');
}

beforeAll(async () => {
    assertSafeTestDatabase(process.env.MONGODB_TEST_URI, process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_TEST_URI);

    await mongoose.connection.db.dropDatabase();
    // Index builds started at model load can race the drop above; rebuild them so unique
    // indexes (which atomic limits and dedupe rely on) exist before any test runs.
    await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
});

afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});
