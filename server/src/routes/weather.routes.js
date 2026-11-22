import { Router } from 'express';
import { getWeather } from '../controllers/weather.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { weatherRateLimit } from '../middlewares/rateLimit.middleware.js';
import { validateWeatherQuery } from '../validators/weather.validator.js';

// Weather theme (opt-in in Settings → Appearance). Read-only, so no CSRF token.
const weatherRouter = Router();
weatherRouter.get('/', authMiddleware, weatherRateLimit, validateWeatherQuery, getWeather);

export default weatherRouter;
