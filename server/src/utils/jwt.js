import jwt from 'jsonwebtoken';
import config from '../config/config.js';

export function signAccessToken(user, sessionId) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      sid: sessionId,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${config.ACCESS_TOKEN_TTL_MINUTES}m`,
      issuer: 'devtrack-api',
      audience: 'devtrack-client',
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(
    token,
    config.JWT_SECRET,
    {
      algorithms: ['HS256'],
      issuer: 'devtrack-api',
      audience: 'devtrack-client',
    }
  );
}