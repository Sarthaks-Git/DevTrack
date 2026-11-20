import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRouter from './routes/auth.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import goalRouter from './routes/goal.routes.js';
import projectRouter from './routes/project.routes.js';
import codingProfileRouter from './routes/codingProfile.routes.js';
import journalRouter from './routes/journal.routes.js';
import activityRouter from './routes/activity.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import notificationRouter from './routes/notification.routes.js';
import githubRouter from './routes/github.routes.js';
import { aiRouter, codeFindingRouter, securityReviewRouter } from './routes/ai.routes.js';
import billingRouter from './routes/billing.routes.js';
import { razorpayWebhook } from './controllers/billing.controller.js';
import { apiRateLimit, billingWebhookRateLimit } from './middlewares/rateLimit.middleware.js';
import { rejectUnsafeInput } from './middlewares/sanitize.middleware.js';
import config from './config/config.js';

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy, this lets rate limiting see the real client IP.
app.set('trust proxy', config.TRUST_PROXY);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
}));
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'], maxAge: 600 }));
// Razorpay signs the exact bytes it sends, so this route reads the raw body, before JSON parsing.
// No session or CSRF: the HMAC signature is the authentication.
app.post('/api/billing/webhook', billingWebhookRateLimit, express.raw({ type: 'application/json', limit: '100kb' }), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, razorpayWebhook);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', apiRateLimit);
app.use('/api', (req, res, next) => {
  // Responses contain private user data; never let browsers or proxies cache them.
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', rejectUnsafeInput);
app.get('/', (req, res) => res.send('DevTrack API is running'));
app.get('/api/health', (req, res) => res.json({ message: 'DevTrack API is healthy' }));
app.use('/api/auth', authRouter);
app.use('/api/goals', goalRouter);
app.use('/api/projects', projectRouter);
app.use('/api/coding-profiles', codingProfileRouter);
app.use('/api/journal', journalRouter);
app.use('/api/activity', activityRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/integrations/github', githubRouter);
app.use('/api/ai', aiRouter);
app.use('/api/security-reviews', securityReviewRouter);
app.use('/api/code-findings', codeFindingRouter);
app.use('/api/billing', billingRouter);
app.use((req, res) => res.status(404).json({ message: 'Route not found', code: 'NOT_FOUND' }));
app.use(errorMiddleware);
export default app;
