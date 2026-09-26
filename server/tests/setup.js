import 'dotenv/config';
import mongoose from 'mongoose';
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
    if (!process.env.MONGODB_TEST_URI) {
        throw new Error('MONGODB_TEST_URI is not defined');
    }

    await mongoose.connect(process.env.MONGODB_TEST_URI);

    await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});