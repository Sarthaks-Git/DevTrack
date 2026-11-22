import { getWeatherLogic } from '../services/weather.service.js';

export async function getWeather(req, res, next) {
  try {
    return res.json({ success: true, data: await getWeatherLogic(req.weatherLocation) });
  } catch (error) {
    return next(error);
  }
}
