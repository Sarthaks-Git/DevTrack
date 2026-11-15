import mongoose from 'mongoose';

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('Database configuration is missing');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  process.stdout.write('Database connected\n');
  return mongoose.connection;
}
