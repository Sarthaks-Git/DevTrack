import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { createSession } from './helpers.js';

describe('Journal API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/journal')).status).toBe(401);
  });

  it('creates an entry with normalized tags and returns no owner field', async () => {
    const s = await createSession('journal');
    const res = await s.post('/api/journal').send({
      title: '  Learned Express error handling  ',
      content: 'Async errors must reach next().',
      type: 'learning',
      tags: ['Express', 'express', 'node js'],
      entryDate: '2026-11-01',
    });
    expect(res.status).toBe(201);
    const { entry } = res.body.data;
    expect(entry.title).toBe('Learned Express error handling');
    expect(entry.tags).toEqual(['express', 'node js']);
    expect(entry).not.toHaveProperty('owner');
  });

  it('validates input and rejects unknown fields', async () => {
    const s = await createSession('journal');
    expect((await s.post('/api/journal').send({ content: 'no title' })).status).toBe(400);
    expect((await s.post('/api/journal').send({ title: 'x', owner: '507f1f77bcf86cd799439011' })).status).toBe(400);
    expect((await s.post('/api/journal').send({ title: 'x', tags: ['<script>'] })).status).toBe(400);
    expect((await s.post('/api/journal').send({ title: 'x', content: 'a'.repeat(20001) })).status).toBe(400);
    expect((await s.post('/api/journal').send({ title: 'x', type: 'diary' })).status).toBe(400);
    expect((await s.post('/api/journal').send({ title: 'x', entryDate: '2026-02-30' })).status).toBe(400);
  });

  it('links to own goals but refuses another user\'s goal', async () => {
    const owner = await createSession('journal');
    const other = await createSession('journal');
    const goal = (await owner.post('/api/goals').send({ title: 'Master MongoDB' })).body.goal;
    const foreignGoal = (await other.post('/api/goals').send({ title: 'Someone else goal' })).body.goal;

    const linked = await owner.post('/api/journal').send({ title: 'Indexes', goal: goal._id });
    expect(linked.status).toBe(201);
    expect(linked.body.data.entry.goal.title).toBe('Master MongoDB');

    const foreign = await owner.post('/api/journal').send({ title: 'Sneaky', goal: foreignGoal._id });
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('INVALID_LINK');
  });

  it('searches, filters by tag, paginates, and pins first', async () => {
    const s = await createSession('journal');
    await s.post('/api/journal').send({ title: 'Regex (special) chars', tags: ['regex'] });
    await s.post('/api/journal').send({ title: 'Docker basics', tags: ['devops'] });
    await s.post('/api/journal').send({ title: 'Pinned idea', pinned: true });

    const search = await s.get('/api/journal?q=(special)');
    expect(search.status).toBe(200);
    expect(search.body.data.items.map(item => item.title)).toEqual(['Regex (special) chars']);

    const byTag = await s.get('/api/journal?tag=devops');
    expect(byTag.body.data.items).toHaveLength(1);
    expect(byTag.body.data.tags).toEqual(['devops', 'regex']);

    const all = await s.get('/api/journal?limit=2');
    expect(all.body.data.items[0].title).toBe('Pinned idea');
    expect(all.body.data.total).toBe(3);
    expect(all.body.data.pages).toBe(2);
  });

  it('isolates entries between users for read, update, and delete', async () => {
    const owner = await createSession('journal');
    const attacker = await createSession('journal');
    const id = (await owner.post('/api/journal').send({ title: 'Secret' })).body.data.entry._id;

    expect((await attacker.get(`/api/journal/${id}`)).status).toBe(404);
    expect((await attacker.patch(`/api/journal/${id}`).send({ title: 'Hacked' })).status).toBe(404);
    expect((await attacker.del(`/api/journal/${id}`)).status).toBe(404);
    expect((await attacker.get('/api/journal')).body.data.total).toBe(0);

    const still = await owner.get(`/api/journal/${id}`);
    expect(still.body.data.entry.title).toBe('Secret');
  });

  it('updates and deletes own entries', async () => {
    const s = await createSession('journal');
    const id = (await s.post('/api/journal').send({ title: 'Draft' })).body.data.entry._id;

    const updated = await s.patch(`/api/journal/${id}`).send({ title: 'Final', pinned: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data.entry.title).toBe('Final');
    expect(updated.body.data.entry.pinned).toBe(true);

    expect((await s.patch(`/api/journal/${id}`).send({})).status).toBe(400);
    expect((await s.del(`/api/journal/${id}`)).status).toBe(200);
    expect((await s.get(`/api/journal/${id}`)).status).toBe(404);
    expect((await s.get('/api/journal/not-an-id')).status).toBe(400);
  });

  it('unlinks entries when their goal is deleted', async () => {
    const s = await createSession('journal');
    const goal = (await s.post('/api/goals').send({ title: 'Temporary goal' })).body.goal;
    const id = (await s.post('/api/journal').send({ title: 'Linked', goal: goal._id })).body.data.entry._id;

    await s.del(`/api/goals/${goal._id}`);
    const entry = (await s.get(`/api/journal/${id}`)).body.data.entry;
    expect(entry.goal).toBeNull();
  });
});
