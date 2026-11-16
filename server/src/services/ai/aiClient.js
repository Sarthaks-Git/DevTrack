import crypto from 'crypto';
import mongoose from 'mongoose';
import config, { AI_MODEL_PRICES } from '../../config/config.js';
import AiAllowance from '../../models/AiAllowance.js';
import AiUsage from '../../models/AiUsage.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { createMessage } from './anthropic.transport.js';

export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

// Generous token estimate (2 characters per token) so the budget reservation is a worst case.
const CHARS_PER_TOKEN_FLOOR = 2;

// $/MTok × tokens = millionths of a dollar.
export const costMicroUsd = (model, inputTokens, outputTokens) => {
  const price = AI_MODEL_PRICES[model];
  return Math.ceil(inputTokens * price.input + outputTokens * price.output);
};

// Thrown when AI cannot run for this user right now (off, limit, budget, provider down).
// Background work treats it as "try later" rather than a failure of the item.
export class AiUnavailableError extends AppError {
  constructor(message, statusCode, code) {
    super(message, statusCode, code);
    this.aiUnavailable = true;
  }
}

function logFailure(what, kind) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`AI ${what} failed: ${kind}\n`);
}

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

export async function aiConsentGiven(userId) {
  const user = await User.findById(userId).select('ai accountStatus').lean();
  return Boolean(user && user.accountStatus === 'active' && user.ai?.enabled);
}

// Conditional upsert: succeeds only while the counter is below the limit, so parallel calls cannot overshoot.
async function reserve(filter, condition, inc) {
  // The limit relies on the unique index; on a fresh collection, wait until it exists (cached after first call).
  await AiAllowance.init();
  try {
    return Boolean(await AiAllowance.findOneAndUpdate({ ...filter, ...condition }, { $inc: inc }, { upsert: true, returnDocument: 'after' }));
  } catch (error) {
    // The upsert collided with an existing row that failed the condition: the limit is reached.
    if (error?.code === 11000) return false;
    throw error;
  }
}

const reserveUserAction = (owner, month) =>
  reserve({ scope: 'user', owner, month }, { actions: { $lt: config.AI.userMonthlyLimit } }, { actions: 1 });

const releaseUserAction = (owner, month) =>
  AiAllowance.updateOne({ scope: 'user', owner, month, actions: { $gt: 0 } }, { $inc: { actions: -1 } });

function reserveBudget(month, amount) {
  const cap = config.AI.monthlyBudgetMicroUsd;
  if (amount > cap) return false;
  return reserve({ scope: 'global', owner: null, month }, { costMicroUsd: { $lte: cap - amount } }, { costMicroUsd: amount });
}

async function adjustBudget(month, delta) {
  if (delta) await AiAllowance.updateOne({ scope: 'global', owner: null, month }, { $inc: { costMicroUsd: delta } });
}

function readJson(response) {
  const text = (response?.content || []).filter(block => block?.type === 'text').map(block => block.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Sends one request and returns the parsed JSON answer.
 * Checks, in order: configured → user consent → user's monthly allowance → global monthly budget.
 * `content` is the user-turn text; the caller must already have wrapped untrusted data as data.
 */
export async function generateJson({ userId, feature, system, content, schema, maxTokens = 2000 }) {
  assertUserId(userId);
  if (!config.AI.enabled) throw new AiUnavailableError('AI features are not set up on this server', 503, 'AI_NOT_CONFIGURED');
  const model = config.AI.models[feature];
  if (!model) throw new Error(`Unknown AI feature: ${feature}`);
  if (!(await aiConsentGiven(userId))) throw new AiUnavailableError('Turn on AI features in Settings first', 403, 'AI_CONSENT_REQUIRED');

  const month = monthKey();
  if (!(await reserveUserAction(userId, month))) {
    throw new AiUnavailableError('Monthly AI limit reached. It resets on the 1st.', 429, 'AI_QUOTA_REACHED');
  }

  const inputEstimate = Math.ceil((system.length + content.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN_FLOOR) + 500;
  const reserved = costMicroUsd(model, inputEstimate, maxTokens);
  if (!(await reserveBudget(month, reserved))) {
    await releaseUserAction(userId, month);
    throw new AiUnavailableError('AI is paused for this month on this server.', 503, 'AI_BUDGET_REACHED');
  }

  let response;
  try {
    response = await createMessage({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      // Cheapest path: no extended thinking, low effort, schema-constrained JSON.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      // Opaque per-user id for abuse tracing at the provider; never the email or the raw id.
      metadata: { user_id: crypto.createHash('sha256').update(`devtrack:${userId}`).digest('hex').slice(0, 32) },
    });
  } catch (error) {
    // Nothing billable came back: give both reservations back.
    await Promise.all([releaseUserAction(userId, month), adjustBudget(month, -reserved)]);
    logFailure(feature, error?.kind || error?.name || 'Error');
    throw new AiUnavailableError('The AI service is unavailable. Try again later.', 502, 'AI_UNAVAILABLE');
  }

  const usage = response?.usage || {};
  const inputTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;
  const cost = costMicroUsd(model, inputTokens, outputTokens);
  await adjustBudget(month, cost - reserved);

  let status = 'ok';
  let data;
  if (response?.stop_reason === 'refusal') status = 'refused';
  else if (response?.stop_reason === 'max_tokens') status = 'truncated';
  else {
    data = readJson(response);
    if (!data || typeof data !== 'object' || Array.isArray(data)) status = 'invalid';
  }

  await AiUsage.create({ owner: userId, feature, model, inputTokens, outputTokens, costMicroUsd: cost, status });
  if (status !== 'ok') {
    logFailure(feature, status);
    throw new AppError('The AI could not produce an answer for this.', 502, `AI_${status.toUpperCase()}`);
  }
  return { data, model, costMicroUsd: cost };
}

export async function getAiStatusLogic(userId) {
  assertUserId(userId);
  const month = monthKey();
  const [user, allowance] = await Promise.all([
    User.findById(userId).select('ai').lean(),
    AiAllowance.findOne({ scope: 'user', owner: userId, month }).lean(),
  ]);
  const model = config.AI.models.securityReview;
  return {
    available: config.AI.enabled,
    enabled: Boolean(user?.ai?.enabled),
    changedAt: user?.ai?.changedAt || null,
    plan: 'standard',
    // Pro (a stronger model on a paid plan) is shown but not available until payments exist.
    tiers: [
      { id: 'standard', label: 'Standard', model: AI_MODEL_PRICES[model].label, available: true },
      { id: 'pro', label: 'Pro', model: null, available: false },
    ],
    usage: { month, used: allowance?.actions || 0, limit: config.AI.userMonthlyLimit },
  };
}

export async function setAiConsentLogic(userId, enabled) {
  assertUserId(userId);
  await User.updateOne({ _id: userId }, { $set: { 'ai.enabled': enabled, 'ai.changedAt': new Date() } });
  return getAiStatusLogic(userId);
}
