import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Goal from '../src/models/Goal.js';
import Project from '../src/models/Project.js';
import JournalEntry from '../src/models/JournalEntry.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const todayUtc = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};
const dayKey = offsetDays => new Date(todayUtc() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const daysAgo = days => new Date(todayUtc() - days * DAY_MS);

// Backdate without Mongoose bumping updatedAt again.
const backdate = (Model, id, date) => Model.collection.updateOne({ _id: Model.base.Types.ObjectId.createFromHexString(id) }, { $set: { updatedAt: date } });

describe('Dashboard attention', () => {
  let alice;
  let mallory;

  beforeAll(async () => {
    alice = await createSession('att_alice');
    mallory = await createSession('att_mallory');
  });

  const attention = (session, today = dayKey(0)) => session.get(`/api/dashboard/attention?today=${today}`);
  const find = (response, id) => response.body.data.items.find(item => item.id === id);

  async function goal(session, body) {
    const response = await session.post('/api/goals').send(body);
    expect(response.status).toBe(201);
    return response.body.goal;
  }

  it('requires authentication', async () => {
    const response = await request(app).get('/api/dashboard/attention');
    expect(response.status).toBe(401);
  });

  it('rejects malformed, impossible, far-off dates and unknown query fields', async () => {
    for (const query of ['today=2026-13-01', 'today=2026-02-30', 'today=tomorrow', `today=${dayKey(5)}`, `today=${dayKey(-3)}`, 'other=1', 'today[$gt]=1']) {
      const response = await alice.get(`/api/dashboard/attention?${query}`);
      expect(response.status, query).toBe(400);
    }
  });

  it('accepts the neighbouring day for viewers in other timezones and defaults to the UTC day', async () => {
    expect((await attention(alice, dayKey(1))).status).toBe(200);
    expect((await attention(alice, dayKey(-1))).status).toBe(200);
    const plain = await alice.get('/api/dashboard/attention');
    expect(plain.status).toBe(200);
    expect(plain.body.data.today).toBe(dayKey(0));
  });

  it('flags overdue and due-soon deadlines but not distant or missing ones', async () => {
    const overdue = await goal(alice, { title: 'Overdue goal', deadline: dayKey(-2), status: 'in_progress' });
    const soon = await goal(alice, { title: 'Soon goal', deadline: dayKey(3) });
    const later = await goal(alice, { title: 'Later goal', deadline: dayKey(30) });
    const undated = await goal(alice, { title: 'Undated goal' });

    const response = await attention(alice);
    expect(response.status).toBe(200);
    expect(find(response, overdue._id).reasons).toEqual([{ code: 'overdue', date: `${dayKey(-2)}T00:00:00.000Z` }]);
    expect(find(response, soon._id).reasons[0].code).toBe('due_soon');
    expect(find(response, later._id)).toBeUndefined();
    expect(find(response, undated._id)).toBeUndefined();
  });

  it('uses the viewer day: a deadline today is due soon, not overdue', async () => {
    const dueToday = await goal(alice, { title: 'Due today goal', deadline: dayKey(0) });
    expect(find(await attention(alice), dueToday._id).reasons[0].code).toBe('due_soon');
    expect(find(await attention(alice, dayKey(1)), dueToday._id).reasons[0].code).toBe('overdue');
  });

  it('flags overdue milestones and suggests the earliest open milestone as the next step', async () => {
    const parent = await goal(alice, { title: 'Milestone goal' });
    await alice.post(`/api/goals/${parent._id}/milestones`).send({ title: 'Later step', dueDate: dayKey(20) });
    await alice.post(`/api/goals/${parent._id}/milestones`).send({ title: 'Late step', dueDate: dayKey(-1) });

    const item = find(await attention(alice), parent._id);
    expect(item.reasons).toEqual([{ code: 'milestone_overdue', count: 1, date: `${dayKey(-1)}T00:00:00.000Z` }]);
    expect(item.nextStep).toEqual({ code: 'milestone', title: 'Late step', dueDate: `${dayKey(-1)}T00:00:00.000Z` });
  });

  it('marks an in-progress goal stalled after 14 idle days, and linked work or notes count as activity', async () => {
    const stalled = await goal(alice, { title: 'Stalled goal', status: 'in_progress' });
    const viaJournal = await goal(alice, { title: 'Journal-touched goal', status: 'in_progress' });
    const viaProject = await goal(alice, { title: 'Project-touched goal', status: 'in_progress' });
    const notStarted = await goal(alice, { title: 'Idle but not started' });
    for (const g of [stalled, viaJournal, viaProject, notStarted]) await backdate(Goal, g._id, daysAgo(20));

    expect((await alice.post('/api/journal').send({ title: 'Progress note', goal: viaJournal._id })).status).toBe(201);
    expect((await alice.post('/api/projects').send({ title: 'Linked work', goal: viaProject._id })).status).toBe(201);

    const response = await attention(alice);
    const item = find(response, stalled._id);
    expect(item.reasons).toEqual([{ code: 'stalled', days: 20 }]);
    expect(item.nextStep).toEqual({ code: 'add_milestones' });
    expect(find(response, viaJournal._id)).toBeUndefined();
    expect(find(response, viaProject._id)).toBeUndefined();
    expect(find(response, notStarted._id)).toBeUndefined();
  });

  it('covers projects by end date and stalls, and ignores completed or archived work', async () => {
    const created = await alice.post('/api/projects').send({ title: 'Late project', status: 'in_progress', endDate: dayKey(-4) });
    expect(created.status).toBe(201);
    const project = created.body.data.project;
    const done = await alice.post('/api/projects').send({ title: 'Done project', status: 'completed', endDate: dayKey(-4) });
    const doneGoal = await goal(alice, { title: 'Done goal', status: 'completed', deadline: dayKey(-4) });

    const response = await attention(alice);
    expect(find(response, project._id)).toMatchObject({ kind: 'project', reasons: [{ code: 'overdue' }] });
    expect(find(response, done.body.data.project._id)).toBeUndefined();
    expect(find(response, doneGoal._id)).toBeUndefined();
  });

  it('ranks by severity then priority and caps the list while reporting the total', async () => {
    const session = await createSession('att_rank');
    const low = await goal(session, { title: 'Low overdue', priority: 'low', deadline: dayKey(-1) });
    const high = await goal(session, { title: 'High overdue', priority: 'high', deadline: dayKey(-1) });
    const soon = await goal(session, { title: 'High soon', priority: 'high', deadline: dayKey(2) });
    for (let i = 0; i < 4; i += 1) await goal(session, { title: `Filler ${i}`, deadline: dayKey(5) });

    const { data } = (await attention(session)).body;
    expect(data.total).toBe(7);
    expect(data.items).toHaveLength(5);
    expect(data.items.slice(0, 3).map(item => item.id)).toEqual([high._id, low._id, soon._id]);
  });

  it('never returns another user\'s goals, projects or journal activity', async () => {
    const secret = await goal(mallory, { title: 'Mallory secret', deadline: dayKey(-1) });
    const response = await attention(alice);
    expect(find(response, secret._id)).toBeUndefined();

    // Mallory's note pointing at someone else's goal must not wake it up either.
    // A fresh user keeps the list under the 5-item cap.
    const victim = await createSession('att_victim');
    const own = await goal(victim, { title: 'Victim idle goal', status: 'in_progress' });
    await backdate(Goal, own._id, daysAgo(30));
    await JournalEntry.create({ owner: mallory.userId, title: 'Spoof', goal: own._id });
    expect(find(await attention(victim), own._id).reasons[0].code).toBe('stalled');
    expect(await Project.countDocuments({ owner: mallory.userId })).toBe(0);
  });
});
