import { getAiStatusLogic, setAiConsentLogic } from '../services/ai/aiClient.js';
import {
  listCodeFindingsLogic,
  setCodeFindingStatusLogic,
  setCodeReviewLogic,
  startCodeReview,
} from '../services/codeReview.service.js';
import {
  listSecurityReviewsLogic,
  setSecurityReviewStatusLogic,
  startSecurityScan,
  updateSecurityItemLogic,
} from '../services/securityReview.service.js';

const ok = (res, data) => res.status(200).json({ success: true, data });

export async function getAiStatus(req, res, next) {
  try {
    return ok(res, await getAiStatusLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function setAiConsent(req, res, next) {
  try {
    const status = await setAiConsentLogic(req.auth.userId, req.validatedConsent);
    // Turning AI on reviews commits synced while it was off; runs in the background.
    if (status.enabled && status.available) {
      startSecurityScan(req.auth.userId);
      startCodeReview(req.auth.userId);
    }
    return ok(res, status);
  } catch (error) {
    return next(error);
  }
}

export async function listSecurityReviews(req, res, next) {
  try {
    return ok(res, await listSecurityReviewsLogic(req.auth.userId, req.validatedQuery));
  } catch (error) {
    return next(error);
  }
}

export async function setSecurityReviewStatus(req, res, next) {
  try {
    return ok(res, { review: await setSecurityReviewStatusLogic(req.auth.userId, req.params.id, req.validatedStatus) });
  } catch (error) {
    return next(error);
  }
}

export async function updateSecurityItem(req, res, next) {
  try {
    return ok(res, { review: await updateSecurityItemLogic(req.auth.userId, req.params.id, req.params.itemKey, req.validatedState) });
  } catch (error) {
    return next(error);
  }
}

export async function setCodeReview(req, res, next) {
  try {
    const result = await setCodeReviewLogic(req.auth.userId, req.params.id, req.validatedCodeReview);
    // Turning it on reviews recent commits in the background.
    if (result.enabled) startCodeReview(req.auth.userId);
    return ok(res, { codeReview: result });
  } catch (error) {
    return next(error);
  }
}

export async function listCodeFindings(req, res, next) {
  try {
    return ok(res, await listCodeFindingsLogic(req.auth.userId, req.validatedQuery));
  } catch (error) {
    return next(error);
  }
}

export async function setCodeFindingStatus(req, res, next) {
  try {
    return ok(res, { finding: await setCodeFindingStatusLogic(req.auth.userId, req.params.id, req.validatedStatus) });
  } catch (error) {
    return next(error);
  }
}
