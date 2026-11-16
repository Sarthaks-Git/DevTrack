import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { SECURITY_ITEM_STATES } from '../models/SecurityReview.js';
import { CODE_FINDING_STATUSES } from '../models/CodeFinding.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const plainObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const onlyKeys = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));

export function validateAiConsent(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['enabled']) || typeof body.enabled !== 'boolean') {
    return next(fail({ enabled: 'enabled must be true or false' }));
  }
  req.validatedConsent = body.enabled;
  return next();
}

export function validateSecurityReviewList(req, res, next) {
  const { status, project } = req.query;
  const errors = {};
  if (!onlyKeys(req.query, ['status', 'project'])) errors.fields = 'Query contains invalid fields';
  if (status !== undefined && !['open', 'done', 'dismissed'].includes(status)) errors.status = 'status must be open, done or dismissed';
  if (project !== undefined && (typeof project !== 'string' || !mongoose.isValidObjectId(project))) errors.project = 'Invalid project id';
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedQuery = { status, project };
  return next();
}

export function validateSecurityReviewStatus(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['status']) || !['open', 'dismissed'].includes(body.status)) {
    return next(fail({ status: 'status must be open or dismissed' }));
  }
  req.validatedStatus = body.status;
  return next();
}

export function validateSecurityItem(req, res, next) {
  const body = plainObject(req.body);
  const errors = {};
  if (!/^[a-f0-9]{8}$/.test(req.params.itemKey || '')) errors.itemKey = 'Invalid item';
  if (!body || !onlyKeys(body, ['state']) || !SECURITY_ITEM_STATES.includes(body.state)) {
    errors.state = `state must be one of ${SECURITY_ITEM_STATES.join(', ')}`;
  }
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedState = body.state;
  return next();
}

export function validateCodeReviewToggle(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['enabled']) || typeof body.enabled !== 'boolean') {
    return next(fail({ enabled: 'enabled must be true or false' }));
  }
  req.validatedCodeReview = body.enabled;
  return next();
}

export function validateCodeFindingList(req, res, next) {
  const { status, project } = req.query;
  const errors = {};
  if (!onlyKeys(req.query, ['status', 'project'])) errors.fields = 'Query contains invalid fields';
  if (status !== undefined && !CODE_FINDING_STATUSES.includes(status)) errors.status = `status must be one of ${CODE_FINDING_STATUSES.join(', ')}`;
  if (project !== undefined && (typeof project !== 'string' || !mongoose.isValidObjectId(project))) errors.project = 'Invalid project id';
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedQuery = { status, project };
  return next();
}

export function validateCodeFindingStatus(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['status']) || !CODE_FINDING_STATUSES.includes(body.status)) {
    return next(fail({ status: `status must be one of ${CODE_FINDING_STATUSES.join(', ')}` }));
  }
  req.validatedStatus = body.status;
  return next();
}
