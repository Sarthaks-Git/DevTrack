import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import cookieParser from 'cookie-parser';
import goalRouter from './routes/goal.routes.js';


const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    res.send('DevTrack API is running');
});

app.get('/api/health', (req, res) => {
    res.json({ message: 'DevTrack API is healthy' });
});

app.use('/api/auth', authRouter);
app.use('/api/goals', goalRouter);

app.use(errorMiddleware);

export default app;