
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import AppError from '../utils/AppError.js';
import config from '../config/config.js';
import { signAccessToken } from '../utils/jwt.js';

export const SALT_ROUNDS = 12;

// Compared against when the email is unknown so response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('devtrack-timing-equalizer', SALT_ROUNDS);

const REFRESH_DAYS = config.REFRESH_TOKEN_TTL_DAYS;

const hash = value =>
  crypto.createHash('sha256').update(value).digest('hex');

export const publicUser = user => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const safeEqual = (a, b) => {
  const x = Buffer.from(a || '');
  const y = Buffer.from(b || '');

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );
};

function makeRefreshToken(sessionId) {
  return `${sessionId}.${crypto.randomBytes(48).toString('base64url')}`;
}

async function revokeSessionFamily(familyId, reason, now = new Date()) {
  await AuthSession.updateMany(
    {
      familyId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: now,
        revokeReason: reason,
      },
    }
  );
}

function describeUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return null;
  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
      : /Firefox\//.test(userAgent) ? 'Firefox'
        : /Chrome\//.test(userAgent) ? 'Chrome'
          : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
      : /iPhone|iPad/.test(userAgent) ? 'iOS'
        : /Mac OS X/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

export async function createLoginSession(user, { userAgent } = {}) {
  const sessionId = new mongoose.Types.ObjectId();

  const refreshToken = makeRefreshToken(
    sessionId.toString()
  );

  const session = await AuthSession.create({
    _id: sessionId,
    owner: user._id,
    familyId: crypto.randomUUID(),
    tokenHash: hash(refreshToken),
    userAgent: describeUserAgent(userAgent),
    expiresAt: new Date(
      Date.now() + REFRESH_DAYS * 86_400_000
    ),
  });

  return {
    user: publicUser(user),
    accessToken: signAccessToken(
      user,
      session._id.toString()
    ),
    refreshToken,
    sessionId: session._id.toString(),
  };
}

export async function registerLogic(username, email, password, meta = {}) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await User.findOne({
    $or: [
      { username: normalizedUsername },
      { email: normalizedEmail },
    ],
  });

  if (existing) {
    throw new AppError(
      'Username or email already exists',
      409,
      'ACCOUNT_EXISTS'
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  try {
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    return createLoginSession(user, meta);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        'Username or email already exists',
        409,
        'ACCOUNT_EXISTS'
      );
    }

    throw error;
  }
}

export async function loginLogic(email, password, meta = {}) {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  }).select('+passwordHash');

  const hashToCompare = user?.passwordHash || DUMMY_HASH;

  const matches = await bcrypt.compare(
    password,
    hashToCompare
  );

  if (
    !user ||
    user.accountStatus !== 'active' ||
    !matches
  ) {
    throw new AppError(
      'Invalid email or password',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  return createLoginSession(user, meta);
}

export async function getMeLogic(userId) {
  const user = await User.findById(userId);

  if (!user || user.accountStatus !== 'active') {
    throw new AppError(
      'User does not exist',
      404,
      'USER_NOT_FOUND'
    );
  }

  return publicUser(user);
}

export async function refreshLoginSession(refreshToken) {
  if (typeof refreshToken !== 'string') {
    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  const splitAt = refreshToken.indexOf('.');

  if (
    splitAt < 1 ||
    splitAt === refreshToken.length - 1
  ) {
    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  const sessionId = refreshToken.slice(0, splitAt);

  if (!/^[a-f0-9]{24}$/i.test(sessionId)) {
    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  const session = await AuthSession.findById(sessionId)
    .select('+tokenHash +usedTokenHashes');

  if (!session) {
    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  const presentedHash = hash(refreshToken);
  const now = new Date();

  // Detect reuse of a previously rotated refresh token.
  const wasPreviouslyUsed = session.usedTokenHashes?.some(
    tokenHash => safeEqual(tokenHash, presentedHash)
  );

  if (session.revokedAt || session.expiresAt <= now) {
    if (wasPreviouslyUsed) {
      await revokeSessionFamily(
        session.familyId,
        'reuse_detected',
        now
      );

      throw new AppError(
        'Session reuse detected. Please sign in again',
        401,
        'SESSION_REUSED'
      );
    }

    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  // The presented token must match the current token.
  if (!safeEqual(session.tokenHash, presentedHash)) {
    if (wasPreviouslyUsed) {
      await revokeSessionFamily(
        session.familyId,
        'reuse_detected',
        now
      );

      throw new AppError(
        'Session reuse detected. Please sign in again',
        401,
        'SESSION_REUSED'
      );
    }

    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  // Validate the account before consuming the current token.
  const user = await User.findById(session.owner);

  if (!user || user.accountStatus !== 'active') {
    await AuthSession.findOneAndUpdate(
      {
        _id: session._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: now,
          revokeReason: 'account_inactive',
        },
      }
    );

    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  const nextRefresh = makeRefreshToken(
    session._id.toString()
  );

  // Atomic rotation prevents two requests from both
  // successfully consuming the same current token.
  const updated = await AuthSession.findOneAndUpdate(
    {
      _id: session._id,
      tokenHash: session.tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        tokenHash: hash(nextRefresh),
        rotatedAt: now,
        expiresAt: new Date(
          now.getTime() + REFRESH_DAYS * 86_400_000
        ),
      },

      $push: {
        usedTokenHashes: {
          $each: [session.tokenHash],
          $slice: -100,
        },
      },
    },
    {
      returnDocument: 'after',
    }
  );

  if (!updated) {
    const latest = await AuthSession.findById(
      session._id
    ).select('+usedTokenHashes');

    const tokenWasUsed = latest?.usedTokenHashes?.some(
      tokenHash => safeEqual(tokenHash, presentedHash)
    );

    if (tokenWasUsed) {
      await revokeSessionFamily(
        session.familyId,
        'reuse_detected',
        now
      );

      throw new AppError(
        'Session reuse detected. Please sign in again',
        401,
        'SESSION_REUSED'
      );
    }

    throw new AppError(
      'Session is invalid',
      401,
      'SESSION_INVALID'
    );
  }

  return {
    user: publicUser(user),
    accessToken: signAccessToken(
      user,
      session._id.toString()
    ),
    refreshToken: nextRefresh,
    sessionId: session._id.toString(),
  };
}

export async function revokeSession(sessionId) {
  if (!sessionId) return;

  await AuthSession.findOneAndUpdate(
    {
      _id: sessionId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: 'logout',
      },
    }
  );
}

export async function revokeSessionFromRefreshToken(refreshToken) {
  if (typeof refreshToken !== 'string') return;

  const sessionId = refreshToken.split('.')[0];
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return;

  // Only the holder of the current refresh token may end the session.
  await AuthSession.updateOne(
    { _id: sessionId, tokenHash: hash(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: 'logout' } }
  );
}

export async function revokeAllSessions(userId) {
  await AuthSession.updateMany(
    {
      owner: userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: 'logout_all',
      },
    }
  );
}

export async function getActiveSession(sessionId, userId) {
  return AuthSession.findOne({
    _id: sessionId,
    owner: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate('owner', 'role accountStatus');
}
