import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { createSession } from './helpers.js';
import { recordActivity } from '../src/services/activity.service.js';

const types = res => res.body.data.items.map(item => item.type);

describe('Activity timeline API', () => {
  it('requires authentication and is read-only', async () => {
    expect((await request(app).get('/api/activity')).status).toBe(401);
    const s = await createSession('activity');
    expect((await s.post('/api/activity').send({ type: 'goal_completed', title: 'fake' })).status).toBe(404);
  });

  it('records goal lifecycle events and stamps completedAt', async () => {
    const s = await createSession('activity');
    const goal = (await s.post('/api/goals').send({ title: 'Ship DevTrack' })).body.goal;
    expect(goal.completedAt).toBeNull();

    const completed = await s.patch(`/api/goals/${goal._id}`).send({ status: 'completed' });
    expect(completed.body.goal.completedAt).toBeTruthy();

    // Saving a completed goal again must not duplicate the completion event.
    await s.patch(`/api/goals/${goal._id}`).send({ status: 'completed', title: 'Ship DevTrack v1' });

    const reopened = await s.patch(`/api/goals/${goal._id}`).send({ status: 'in_progress' });
    expect(reopened.body.goal.completedAt).toBeNull();

    const res = await s.get('/api/activity');
    expect(res.status).toBe(200);
    expect(types(res)).toEqual(['goal_reopened', 'goal_completed', 'goal_created']);
    expect(res.body.data.items[0]).not.toHaveProperty('owner');
  });

  it('records project and journal events', async () => {
    const s = await createSession('activity');
    const project = (await s.post('/api/projects').send({ title: 'Portfolio site' })).body.data.project;
    await s.patch(`/api/projects/${project._id}`).send({ status: 'completed' });
    await s.post('/api/journal').send({ title: 'Retro notes' });

    const res = await s.get('/api/activity');
    expect(types(res)).toEqual(['journal_created', 'project_completed', 'project_created']);
    expect(res.body.data.items[1].detail).toBe('Planning → Completed');
  });

  it('paginates with a cursor and filters by type', async () => {
    const s = await createSession('activity');
    for (let i = 0; i < 5; i += 1) await s.post('/api/journal').send({ title: `Note ${i}` });

    const first = await s.get('/api/activity?limit=2');
    expect(first.body.data.items).toHaveLength(2);
    const second = await s.get(`/api/activity?limit=2&before=${first.body.data.nextCursor}`);
    const seen = new Set([...first.body.data.items, ...second.body.data.items].map(item => item._id));
    expect(seen.size).toBe(4);

    expect((await s.get('/api/activity?type=not_a_type')).status).toBe(400);
    expect((await s.get('/api/activity?before=garbage')).status).toBe(400);
  });

  it('orders by when things happened, so synced older items fall in place, and pages through ties', async () => {
    const s = await createSession('activity');
    await s.post('/api/journal').send({ title: 'Today note' });
    const day = new Date(Date.now() - 3 * 86_400_000);
    // Recorded now, happened three days ago (like a synced commit); three share one timestamp.
    for (let i = 0; i < 3; i += 1) {
      await recordActivity(s.userId, { type: 'commit_pushed', subjectType: 'github', title: `Old ${i}`, source: 'verified', occurredAt: day });
    }
    await recordActivity(s.userId, { type: 'commit_pushed', subjectType: 'github', title: 'Older', source: 'verified', occurredAt: new Date(day.getTime() - 60_000) });

    const all = await s.get('/api/activity');
    expect(types(all)[0]).toBe('journal_created');
    expect(all.body.data.items.at(-1).title).toBe('Older');

    const seen = [];
    let cursor;
    do {
      const page = await s.get(`/api/activity?limit=2${cursor ? `&before=${cursor}` : ''}`);
      expect(page.status).toBe(200);
      seen.push(...page.body.data.items.map(item => item._id));
      cursor = page.body.data.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.body.data.items.map(item => item._id));

    const commits = await s.get('/api/activity?type=commit_pushed&limit=3');
    const rest = await s.get(`/api/activity?type=commit_pushed&limit=3&before=${commits.body.data.nextCursor}`);
    expect(rest.body.data.items.map(item => item.title)).toEqual(['Older']);
    expect((await s.get('/api/activity?before=123.nothex')).status).toBe(400);
  });

  it('never shows another user\'s activity', async () => {
    const a = await createSession('activity');
    const b = await createSession('activity');
    await a.post('/api/journal').send({ title: 'Only mine' });
    expect((await b.get('/api/activity')).body.data.items).toHaveLength(0);
  });

  it('summarizes recent activity counts', async () => {
    const s = await createSession('activity');
    await s.post('/api/journal').send({ title: 'One' });
    await s.post('/api/journal').send({ title: 'Two' });
    const res = await s.get('/api/activity/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.counts.journal_created).toBe(2);
  });
});
