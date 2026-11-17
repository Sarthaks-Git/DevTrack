import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config, { SOCIAL_PROVIDERS } from '../config/config.js';
import AuthIdentity from '../models/AuthIdentity.js';
import AuthSession from '../models/AuthSession.js';
import OAuthState from '../models/OAuthState.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { decryptSecret, encryptSecret, randomToken, sha256 } from '../utils/tokenCrypto.js';
import { SALT_ROUNDS, createLoginSession } from './auth.service.js';
import { buildAuthorizeUrl, fetchSocialProfile, usesPkce } from './socialProviders.service.js';
import { createLoginChallenge, isTwoFactorEnabled } from './loginChallenge.service.js';

export const SOCIAL_RULES = {
  stateTtlMs: 10 * 60 * 1000,
  // Accounts without a password confirm sensitive changes by having signed in this recently.
  freshSignInMs: 10 * 60 * 1000,
};

const LABELS = { google: 'Google', github: 'GitHub', linkedin: 'LinkedIn' };

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function assertProvider(provider) {
  if (!SOCIAL_PROVIDERS.includes(provider)) throw new AppError('Unknown sign-in provider', 404, 'PROVIDER_NOT_FOUND');
  if (!config.SOCIAL[provider].enabled) throw new AppError(`${LABELS[provider]} sign-in is not set up on this server`, 503, 'PROVIDER_NOT_CONFIGURED');
}

function logFailure(provider, reason) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`Social sign-in (${provider}) failed: ${reason}\n`);
}

// The verifier is encrypted with associated data bound to this exact handshake.
const verifierContext = (provider, stateHash) => `oauth:${provider}:${stateHash}`;

export function listProvidersLogic() {
  return { providers: SOCIAL_PROVIDERS.map(id => ({ id, label: LABELS[id], enabled: config.SOCIAL[id].enabled })) };
}

/**
 * Step 1. purpose 'login' (signed out, or re-confirming identity) or 'link' (signed in).
 * Returns the raw state for the controller to pin to this browser in a cookie.
 */
export async function startSocialLogic({ provider, purpose, userId = null, returnTo = 'app' }) {
  assertProvider(provider);
  if (purpose === 'link') assertUserId(userId);
  const state = randomToken(32);
  const stateHash = sha256(state);
  const verifier = usesPkce(provider) ? randomToken(48) : null;
  if (purpose === 'link') await OAuthState.deleteMany({ owner: userId, purpose: 'link' });
  await OAuthState.create({
    owner: purpose === 'link' ? userId : null,
    provider,
    purpose,
    returnTo: purpose === 'login' && returnTo === 'settings' ? 'settings' : 'app',
    stateHash,
    codeVerifier: verifier ? encryptSecret(verifier, verifierContext(provider, stateHash)) : null,
    expiresAt: new Date(Date.now() + SOCIAL_RULES.stateTtlMs),
  });
  const codeChallenge = verifier ? crypto.createHash('sha256').update(verifier).digest('base64url') : null;
  return { state, authorizeUrl: buildAuthorizeUrl(provider, { state, codeChallenge }) };
}

function sameState(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Lowercase, starts with a letter, 3-30 of [a-z0-9_]; a random suffix when taken.
async function freeUsername(seed) {
  let base = String(seed || '').toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/^[^a-z]+/, '').slice(0, 24);
  if (base.length < 3) base = `dev${base}`.slice(0, 24);
  if (!(await User.exists({ username: base }))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base.slice(0, 24)}_${crypto.randomInt(1000, 99999)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `dev_${crypto.randomBytes(6).toString('hex')}`;
}

async function createSocialUser(provider, profile) {
  // Unusable password hash: password sign-in cannot succeed until the user sets one.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), SALT_ROUNDS);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const user = await User.create({
        username: await freeUsername(profile.login || profile.name || profile.email.split('@')[0]),
        email: profile.email,
        passwordHash,
        passwordSet: false,
      });
      try {
        await AuthIdentity.create({ owner: user._id, provider, providerUserId: profile.providerUserId, email: profile.email, displayName: profile.name, lastUsedAt: new Date() });
      } catch (error) {
        // A parallel callback linked this provider account first: undo the new user.
        await User.deleteOne({ _id: user._id });
        throw error;
      }
      return user;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // Lost a race for the username or the email; the loop retries or the caller reports it.
      if (await User.exists({ email: profile.email })) return null;
    }
  }
  return null;
}

/**
 * Step 2. Never throws to the browser: returns { outcome, redirect, session? }.
 * Outcomes: signed_in, linked, denied, expired, failed, email_unverified, email_exists, in_use, already_linked.
 */
export async function completeSocialLogic({ provider, code, state, error, browserState, userAgent }) {
  const fail = (outcome, purpose = 'login', returnTo = 'app') => ({ outcome, purpose, returnTo });
  if (!SOCIAL_PROVIDERS.includes(provider) || !config.SOCIAL[provider].enabled) return fail('failed');
  if (!state || !sameState(state, browserState)) {
    logFailure(provider, !state ? 'no_state' : browserState ? 'state_mismatch' : 'no_state_cookie');
    return fail('expired');
  }
  const stateHash = sha256(state);
  const record = await OAuthState.findOneAndDelete({ stateHash, provider, purpose: { $in: ['login', 'link'] }, expiresAt: { $gt: new Date() } });
  if (!record) {
    logFailure(provider, 'state_not_found');
    return fail('expired');
  }
  const { purpose, returnTo } = record;
  if (error) return fail('denied', purpose, returnTo);
  if (!code) return fail('failed', purpose, returnTo);

  let profile;
  try {
    const codeVerifier = record.codeVerifier ? decryptSecret(record.codeVerifier, verifierContext(provider, stateHash)) : null;
    profile = await fetchSocialProfile(provider, { code, codeVerifier });
  } catch (failure) {
    logFailure(provider, `${failure?.kind || failure?.name || 'Error'}${failure?.detail ? ` (${failure.detail})` : ''}`);
    return fail('failed', purpose, returnTo);
  }
  // Only an address the provider itself verified may identify or create an account.
  if (!profile.emailVerified || !profile.email) return fail('email_unverified', purpose, returnTo);

  const identity = await AuthIdentity.findOne({ provider, providerUserId: profile.providerUserId });

  if (purpose === 'link') {
    if (identity && String(identity.owner) !== String(record.owner)) return fail('in_use', purpose);
    if (identity) return fail('linked', purpose);
    const owner = await User.findById(record.owner).select('accountStatus').lean();
    if (!owner || owner.accountStatus !== 'active') return fail('failed', purpose);
    if (await AuthIdentity.exists({ owner: record.owner, provider })) return fail('already_linked', purpose);
    try {
      await AuthIdentity.create({ owner: record.owner, provider, providerUserId: profile.providerUserId, email: profile.email, displayName: profile.name });
    } catch (failure) {
      if (failure?.code === 11000) return fail('in_use', purpose);
      throw failure;
    }
    return fail('linked', purpose);
  }

  // Sign in.
  let user;
  if (identity) {
    user = await User.findById(identity.owner);
    if (!user || user.accountStatus !== 'active') return fail('failed', purpose, returnTo);
    await AuthIdentity.updateOne({ _id: identity._id }, { $set: { lastUsedAt: new Date(), email: profile.email } });
  } else {
    // DevTrack does not verify emails at sign-up, so an existing account with this address may not
    // belong to this person. Never attach automatically: the owner links it from Settings instead.
    if (await User.exists({ email: profile.email })) return fail('email_exists', purpose, returnTo);
    if (returnTo === 'settings') return fail('failed', purpose, returnTo);
    user = await createSocialUser(provider, profile);
    if (!user) return fail('email_exists', purpose, returnTo);
  }
  // With 2FA on, the provider is only the first factor: the authenticator code comes next.
  if (await isTwoFactorEnabled(user._id)) {
    const challengeToken = await createLoginChallenge(user, { method: provider, userAgent, returnTo });
    return { outcome: 'two_factor', purpose, returnTo, challengeToken };
  }
  const session = await createLoginSession(user, { userAgent, method: provider });
  return { outcome: 'signed_in', purpose, returnTo, session };
}

export async function listIdentitiesLogic(userId) {
  assertUserId(userId);
  const identities = await AuthIdentity.find({ owner: userId }).sort({ linkedAt: 1 }).lean();
  return {
    identities: identities.map(identity => ({
      provider: identity.provider,
      label: LABELS[identity.provider],
      email: identity.email,
      linkedAt: identity.linkedAt,
      lastUsedAt: identity.lastUsedAt,
    })),
  };
}

/**
 * Confirms it is really the account owner before a sensitive change.
 * With a password: the current password. Without one (social-only account): a sign-in within the
 * last few minutes on this session.
 */
export async function confirmAccountOwner(userId, sessionId, currentPassword) {
  assertUserId(userId);
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || user.accountStatus !== 'active') throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  if (user.passwordSet !== false) {
    if (typeof currentPassword !== 'string' || !currentPassword) {
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      error.errors = { currentPassword: 'Current password is required' };
      throw error;
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    return user;
  }
  const session = mongoose.isValidObjectId(sessionId) ? await AuthSession.findOne({ _id: sessionId, owner: userId, revokedAt: null }).select('createdAt').lean() : null;
  if (!session || Date.now() - session.createdAt.getTime() > SOCIAL_RULES.freshSignInMs) {
    throw new AppError('For your security, sign in again to confirm this change', 401, 'REAUTH_REQUIRED');
  }
  return user;
}

export async function unlinkIdentityLogic(userId, sessionId, provider, currentPassword) {
  if (!SOCIAL_PROVIDERS.includes(provider)) throw new AppError('Unknown sign-in provider', 404, 'PROVIDER_NOT_FOUND');
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  const identity = await AuthIdentity.findOne({ owner: user._id, provider });
  if (!identity) throw new AppError(`${LABELS[provider]} is not linked to this account`, 404, 'IDENTITY_NOT_FOUND');
  // Never remove the last way in.
  if (user.passwordSet === false && (await AuthIdentity.countDocuments({ owner: user._id })) <= 1) {
    throw new AppError('Set a password or link another sign-in method first', 409, 'LAST_SIGN_IN_METHOD');
  }
  await AuthIdentity.deleteOne({ _id: identity._id });
}
