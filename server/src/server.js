import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDB();

        app.listen(port, () => {
            console.log(`Server started at port ${port}`);
        });
    } catch (error) {
        console.error(
            'Failed to start server:',
            error.message
        );

        process.exit(1);
    }
}

startServer();