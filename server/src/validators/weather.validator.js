import AppError from '../utils/AppError.js';
import { roundCoordinate } from '../services/weather.service.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const NUMBER = /^-?\d{1,3}(?:\.\d{1,8})?$/;

function coordinate(value, limit) {
  if (typeof value !== 'string' || !NUMBER.test(value)) return null;
  const number = Number(value);
  return Math.abs(number) <= limit ? roundCoordinate(number) : null;
}

// GET /api/weather?lat=..&lon=.. — rounded here as well, whatever precision the browser sent.
export function validateWeatherQuery(req, res, next) {
  const query = req.query || {};
  const errors = {};
  if (Object.keys(query).some(key => key !== 'lat' && key !== 'lon')) errors.fields = 'Query contains invalid fields';
  const lat = coordinate(query.lat, 90);
  const lon = coordinate(query.lon, 180);
  if (lat === null) errors.lat = 'Latitude must be a number between -90 and 90';
  if (lon === null) errors.lon = 'Longitude must be a number between -180 and 180';
  if (Object.keys(errors).length) return next(fail(errors));
  req.weatherLocation = { lat, lon };
  return next();
}
