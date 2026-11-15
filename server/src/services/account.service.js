import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import CodingProfile from '../models/CodingProfile.js';
import VerificationChallenge from '../models/VerificationChallenge.js';
import JournalEntry from '../models/JournalEntry.js';
import Activity from '../models/Activity.js';
import CodingSubmission from '../models/CodingSubmission.js';
import SolvedProblem from '../models/SolvedProblem.js';
import Notification from '../models/Notification.js';
import AppError from '../utils/AppError.js';
import { SALT_ROUNDS, publicUser } from './auth.service.js';
import { passwordProblem } from '../validators/account.validator.js';

// Every collection holding user-owned data. Account deletion must cover all of them.
const OWNED_MODELS = [Goal, Project, CodingProfile, VerificationChallenge, JournalEntry, Activity, CodingSubmission, SolvedProblem, Notification, AuthSession];

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

async function loadUserWithPassword(userId, currentPassword) {
  assertUserId(userId);
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || user.accountStatus !== 'active') throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
  return user;
}

async function revokeOtherSessions(userId, keepSessionId, reason) {
  await AuthSession.updateMany(
    { owner: userId, revokedAt: null, _id: { $ne: keepSessionId } },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
}

export async function updateProfileLogic(userId, sessionId, { username, email, currentPassword }) {
  const user = await loadUserWithPassword(userId, currentPassword);
  const updates = {};
  if (username !== undefined && username !== user.username) updates.username = username;
  if (email !== undefined && email !== user.email) updates.email = email;
  if (!Object.keys(updates).length) return { user: publicUser(user), changed: false };

  const conflict = await User.findOne({
    _id: { $ne: user._id },
    $or: Object.entries(updates).map(([field, value]) => ({ [field]: value })),
  }).lean();
  if (conflict) throw new AppError('That username or email is already in use', 409, 'ACCOUNT_EXISTS');

  Object.assign(user, updates);
  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000) throw new AppError('That username or email is already in use', 409, 'ACCOUNT_EXISTS');
    throw error;
  }

  // An email change moves account recovery; sign out every other device.
  if (updates.email) await revokeOtherSessions(user._id, sessionId, 'email_change');
  return { user: publicUser(user), changed: true };
}

export async function changePasswordLogic(userId, sessionId, { currentPassword, newPassword }) {
  const user = await loadUserWithPassword(userId, currentPassword);
  const problem = passwordProblem(newPassword, { username: user.username, email: user.email });
  if (problem) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = { newPassword: problem };
    throw error;
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeOtherSessions(user._id, sessionId, 'password_change');
}

export async function listSessionsLogic(userId, currentSessionId) {
  assertUserId(userId);
  const sessions = await AuthSession.find({ owner: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ updatedAt: -1 })
    .select('createdAt updatedAt rotatedAt expiresAt userAgent')
    .lean();

  return sessions.map(session => ({
    id: session._id.toString(),
    device: session.userAgent || 'Unknown device',
    createdAt: session.createdAt,
    lastActiveAt: session.rotatedAt || session.createdAt,
    expiresAt: session.expiresAt,
    current: session._id.toString() === currentSessionId,
  }));
}

export async function revokeSessionByIdLogic(userId, sessionId) {
  assertUserId(userId);
  if (!mongoose.isValidObjectId(sessionId)) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  const result = await AuthSession.updateOne(
    { _id: sessionId, owner: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: 'logout' } }
  );
  if (!result.matchedCount) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
}

export async function deleteAccountLogic(userId, { currentPassword }) {
  const user = await loadUserWithPassword(userId, currentPassword);
  // Remove owned data first so a partial failure never leaves orphans behind a deleted user.
  await Promise.all(OWNED_MODELS.map(Model => Model.deleteMany({ owner: user._id })));
  await User.deleteOne({ _id: user._id });
}
