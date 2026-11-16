import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/ai/anthropic.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createMessage: vi.fn() };
});

import { createMessage } from '../src/services/ai/anthropic.transport.js';
import { generateJson, monthKey } from '../src/services/ai/aiClient.js';
import { setUserPlanLogic } from '../src/services/plan.service.js';
import { settleSecurityScans } from '../src/services/securityReview.service.js';
import AiAllowance from '../src/models/AiAllowance.js';
import User from '../src/models/User.js';
import { createSession } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const okAnswer = { stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 10 }, content: [{ type: 'text', text: '{"ok":true}' }] };
const call = (userId, feature = 'securityReview') =>
  generateJson({ userId, feature, system: 'sys', content: 'data', schema: { type: 'object' }, maxTokens: 100 });

async function aiUser(prefix) {
  const s = await createSession(prefix);
  await s.put('/api/ai/consent').send({ enabled: true });
  await settleSecurityScans();
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('plans', () => {
  it('runs Free on Haiku and Pro on Sonnet, each with its own thinking-off setting', async () => {
    const s = await aiUser('plan_models');
    createMessage.mockResolvedValue(okAnswer);
    await call(s.userId);
    expect(createMessage.mock.calls[0][0]).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' } });

    await setUserPlanLogic({ username: s.user.username, tier: 'pro' });
    await call(s.userId);
    expect(createMessage.mock.calls[1][0]).toMatchObject({ model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' } });
  });

  it('keeps code review for Pro', async () => {
    const s = await aiUser('plan_feature');
    await expect(call(s.userId, 'codeReview')).rejects.toMatchObject({ code: 'AI_PLAN_REQUIRED', statusCode: 403 });
    expect(createMessage).not.toHaveBeenCalled();
    // Refused before any allowance is used.
    expect((await AiAllowance.findOne({ scope: 'user', owner: s.userId, month: monthKey() }).lean())?.actions || 0).toBe(0);

    await setUserPlanLogic({ username: s.user.username, tier: 'pro' });
    createMessage.mockResolvedValueOnce(okAnswer);
    await expect(call(s.userId, 'codeReview')).resolves.toMatchObject({ model: 'claude-sonnet-5-5' });
  });

  it('applies each plan its own monthly limit', async () => {
    const s = await aiUser('plan_limit');
    await AiAllowance.updateOne({ scope: 'user', owner: s.userId, month: monthKey() }, { $set: { actions: 100 } }, { upsert: true });
    await expect(call(s.userId)).rejects.toMatchObject({ code: 'AI_QUOTA_REACHED' });

    await setUserPlanLogic({ username: s.user.username, tier: 'pro' });
    createMessage.mockResolvedValue(okAnswer);
    await expect(call(s.userId)).resolves.toBeTruthy();
    expect((await s.get('/api/ai')).body.data.usage).toMatchObject({ used: 101, limit: 300 });

    await AiAllowance.updateOne({ scope: 'user', owner: s.userId, month: monthKey() }, { $set: { actions: 300 } });
    await expect(call(s.userId)).rejects.toMatchObject({ code: 'AI_QUOTA_REACHED' });
  });

  it('treats an expired Pro plan as Free and shows the end date while active', async () => {
    const s = await aiUser('plan_expiry');
    const until = new Date(Date.now() + 30 * DAY);
    await setUserPlanLogic({ username: s.user.username, tier: 'pro', until });
    const active = (await s.get('/api/ai')).body.data;
    expect(active).toMatchObject({ plan: 'pro', planUntil: until.toISOString(), usage: { limit: 300 } });
    expect(active.tiers.map(t => [t.id, t.current, t.available])).toEqual([['free', false, true], ['pro', true, true]]);

    await User.updateOne({ _id: s.userId }, { $set: { 'plan.until': new Date(Date.now() - 1000) } });
    const lapsed = (await s.get('/api/ai')).body.data;
    expect(lapsed).toMatchObject({ plan: 'free', planUntil: null, usage: { limit: 100 } });
    createMessage.mockResolvedValueOnce(okAnswer);
    await call(s.userId);
    expect(createMessage.mock.calls[0][0].model).toBe('claude-haiku-5-5');
  });

  it('can only be changed on the server, with validated input', async () => {
    const s = await aiUser('plan_guard');
    // No request a user can make sets a plan.
    expect((await s.put('/api/ai/consent').send({ enabled: true, plan: 'pro' })).status).toBe(400);
    expect((await s.patch('/api/auth/profile').send({ plan: { tier: 'pro' } })).status).toBe(400);
    expect((await User.findById(s.userId).lean()).plan.tier).toBe('free');

    const name = s.user.username;
    await expect(setUserPlanLogic({ username: name, tier: 'gold' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserPlanLogic({ username: name, tier: 'pro', until: new Date(Date.now() - DAY) })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserPlanLogic({ username: name, tier: 'pro', source: 'browser' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserPlanLogic({ username: '$where', tier: 'pro' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserPlanLogic({ username: 'nobody_here_x', tier: 'pro' })).rejects.toMatchObject({ statusCode: 404 });

    const pro = await setUserPlanLogic({ username: name.toUpperCase(), tier: 'pro' });
    expect(pro.plan).toMatchObject({ tier: 'pro', source: 'admin', until: null });
    const free = await setUserPlanLogic({ username: name, tier: 'free' });
    expect(free.plan).toEqual({ tier: 'free', source: null, since: null, until: null });
  });
});
