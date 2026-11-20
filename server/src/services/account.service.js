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
import GitHubConnection from '../models/GitHubConnection.js';
import GitHubCommit from '../models/GitHubCommit.js';
import OAuthState from '../models/OAuthState.js';
import CodeFinding from '../models/CodeFinding.js';
import AuthIdentity from '../models/AuthIdentity.js';
import TwoFactor from '../models/TwoFactor.js';
import LoginChallenge from '../models/LoginChallenge.js';
import EmailVerification from '../models/EmailVerification.js';
import EmailChange from '../models/EmailChange.js';
import EmailChangeUndo from '../models/EmailChangeUndo.js';
import PasswordReset from '../models/PasswordReset.js';
import SecurityReview from '../models/SecurityReview.js';
import AiUsage from '../models/AiUsage.js';
import AiAllowance from '../models/AiAllowance.js';
import Payment from '../models/Payment.js';
import { revokeGitHubAccess } from './github.service.js';
import { startEmailChangeLogic } from './emailChange.service.js';
import { confirmAccountOwner } from './socialAuth.service.js';
import { assertPasswordNotBreached } from './breachedPassword.service.js';
import AppError from '../utils/AppError.js';
import PushSubscription from '../models/PushSubscription.js';
import GoalQuiz from '../models/GoalQuiz.js';
import WeeklyReviewNote from '../models/WeeklyReviewNote.js';
import ProblemLadder from '../models/ProblemLadder.js';
import { SALT_ROUNDS, publicUser } from './auth.service.js';
import { passwordProblem } from '../validators/account.validator.js';

// Every collection holding user-owned data. Account deletion must cover all of them.
export const OWNED_MODELS = [Goal, Project, CodingProfile, VerificationChallenge, JournalEntry, Activity, CodingSubmission, SolvedProblem, Notification, GitHubConnection, GitHubCommit, OAuthState, SecurityReview, CodeFinding, AiUsage, AiAllowance, Payment, PushSubscription, GoalQuiz, WeeklyReviewNote, ProblemLadder, AuthIdentity, TwoFactor, LoginChallenge, EmailVerification, EmailChange, EmailChangeUndo, PasswordReset, AuthSession];

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}


async function revokeOtherSessions(userId, keepSessionId, reason) {
  await AuthSession.updateMany(
    { owner: userId, revokedAt: null, _id: { $ne: keepSessionId } },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
}

export async function updateProfileLogic(userId, sessionId, { username, email, currentPassword }) {
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  const updates = {};
  if (username !== undefined && username !== user.username) updates.username = username;
  if (email !== undefined && email !== user.email) updates.email = email;
  if (!Object.keys(updates).length) return { user: publicUser(user), changed: false };

  const conflict = await User.findOne({
    _id: { $ne: user._id },
    $or: Object.entries(updates).map(([field, value]) => ({ [field]: value })),
  }).lean();
  if (conflict) throw new AppError('That username or email is already in use', 409, 'ACCOUNT_EXISTS');

  // A verified account keeps its email until the code sent to the new address is entered
  // (services/emailChange.service.js). Sent first, so a throttled or failed send changes nothing.
  // An unverified account's email is unproven anyway: it changes now and is verified as usual.
  let pending = null;
  if (updates.email && user.emailVerifiedAt) {
    pending = await startEmailChangeLogic(user, updates.email);
    delete updates.email;
  }
  if (!Object.keys(updates).length) return { user: publicUser(user), changed: false, pendingEmail: pending.pendingEmail };

  Object.assign(user, updates);
  if (updates.email) user.emailVerifiedAt = null;
  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000) throw new AppError('That username or email is already in use', 409, 'ACCOUNT_EXISTS');
    throw error;
  }

  // An email change moves account recovery; sign out every other device.
  if (updates.email) await revokeOtherSessions(user._id, sessionId, 'email_change');
  return { user: publicUser(user), changed: true, pendingEmail: pending?.pendingEmail || null };
}

// Also sets the first password of an account created through Google, GitHub or LinkedIn.
export async function changePasswordLogic(userId, sessionId, { currentPassword, newPassword }) {
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  const problem = passwordProblem(newPassword, { username: user.username, email: user.email });
  if (problem) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = { newPassword: problem };
    throw error;
  }
  await assertPasswordNotBreached(newPassword, 'newPassword');

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.passwordSet = true;
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

export async function deleteAccountLogic(userId, sessionId, { currentPassword }) {
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  // Withdraw DevTrack's GitHub access at GitHub before the encrypted token is deleted.
  await revokeGitHubAccess(user._id);
  // Remove owned data first so a partial failure never leaves orphans behind a deleted user.
  await Promise.all(OWNED_MODELS.map(Model => Model.deleteMany({ owner: user._id })));
  await User.deleteOne({ _id: user._id });
}
