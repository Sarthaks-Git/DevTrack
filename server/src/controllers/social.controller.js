import config from '../config/config.js';
import {
  SOCIAL_RULES,
  completeSocialLogic,
  listIdentitiesLogic,
  listProvidersLogic,
  startSocialLogic,
  unlinkIdentityLogic,
} from '../services/socialAuth.service.js';
import { DEVICE_COOKIE, SOCIAL_STATE_COOKIE, clearSocialStateCookie, setAuthCookies, setDeviceCookie, setSocialStateCookie, setTwoFactorCookie } from '../utils/cookies.js';
import { CHALLENGE_TTL_MS } from '../services/loginChallenge.service.js';

const ok = (res, data) => res.status(200).json({ success: true, data });

export function listProviders(req, res) {
  return ok(res, listProvidersLogic());
}

async function start(req, res, next, purpose) {
  try {
    const { state, authorizeUrl } = await startSocialLogic({
      provider: req.params.provider,
      purpose,
      userId: req.auth?.userId,
      returnTo: req.validatedReturnTo,
    });
    setSocialStateCookie(res, state, SOCIAL_RULES.stateTtlMs);
    return ok(res, { authorizeUrl });
  } catch (error) {
    return next(error);
  }
}

export const startSocialLogin = (req, res, next) => start(req, res, next, 'login');
export const startSocialLink = (req, res, next) => start(req, res, next, 'link');

// Where the browser goes after the provider: only an outcome word, never a code, state or token.
function destination({ outcome, purpose, returnTo }, provider) {
  const base = config.CLIENT_ORIGIN;
  if (purpose === 'link') return `${base}/app/settings?signin=${outcome}&provider=${provider}#signin`;
  if (outcome === 'two_factor') return `${base}/login?step=2fa`;
  if (outcome === 'signed_in') return returnTo === 'settings' ? `${base}/app/settings?reauth=ok#account` : `${base}/app/dashboard`;
  if (returnTo === 'settings') return `${base}/app/settings?reauth=${outcome}#account`;
  return `${base}/login?oauth=${outcome}&provider=${provider}`;
}

export async function socialCallback(req, res) {
  const { provider } = req.params;
  let result = { outcome: 'failed', purpose: 'login', returnTo: 'app' };
  try {
    if (req.socialCallback) {
      result = await completeSocialLogic({
        provider,
        ...req.socialCallback,
        browserState: req.cookies?.[SOCIAL_STATE_COOKIE],
        userAgent: req.get('user-agent'),
        deviceToken: req.cookies?.[DEVICE_COOKIE],
      });
    } else if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(`Social sign-in (${provider}) failed: invalid parameters\n`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') process.stderr.write(`Social sign-in (${provider}) failed: unexpected ${error?.name || 'Error'}\n`);
  }
  clearSocialStateCookie(res);
  if (result.session) {
    setAuthCookies(res, result.session);
    setDeviceCookie(res, result.session.deviceToken);
  }
  if (result.challengeToken) setTwoFactorCookie(res, result.challengeToken, CHALLENGE_TTL_MS);
  res.set('Referrer-Policy', 'no-referrer');
  return res.redirect(303, destination(result, provider));
}

export async function listIdentities(req, res, next) {
  try {
    return ok(res, await listIdentitiesLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function unlinkIdentity(req, res, next) {
  try {
    await unlinkIdentityLogic(req.auth.userId, req.auth.sessionId, req.params.provider, req.body?.currentPassword);
    return ok(res, { unlinked: true });
  } catch (error) {
    return next(error);
  }
}
