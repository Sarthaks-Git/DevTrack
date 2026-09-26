import mongoose from 'mongoose'

export async function connectDB(uri=process.env.MONGODB_URI) {
    try {
        const conn = await mongoose.connect(uri);

        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};
