import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Goal from '../src/models/Goal.js';
import { MAX_MILESTONES } from '../src/models/milestone.schema.js';
import { createSession } from './helpers.js';

const goalOf = response => response.body.goal;
const projectOf = response => response.body.data.project;

describe('Milestones and goal links', () => {
  let alice;
  let mallory;

  beforeAll(async () => {
    alice = await createSession('ms_alice');
    mallory = await createSession('ms_mallory');
  });

  async function newGoal(session = alice, title = 'Ship DevTrack v1') {
    const response = await session.post('/api/goals').send({ title });
    expect(response.status).toBe(201);
    return response.body.goal;
  }

  async function newProject(session = alice, extra = {}) {
    const response = await session.post('/api/projects').send({ title: 'DevTrack API', ...extra });
    return response;
  }

  describe('goal milestones', () => {
    it('adds, renames, completes, reopens and deletes a milestone', async () => {
      const goal = await newGoal();

      const added = await alice.post(`/api/goals/${goal._id}/milestones`).send({ title: '  Auth done  ', dueDate: '2026-12-01' });
      expect(added.status).toBe(201);
      const [milestone] = goalOf(added).milestones;
      expect(milestone).toMatchObject({ title: 'Auth done', done: false, completedAt: null });
      expect(milestone.dueDate).toBe('2026-12-01T00:00:00.000Z');

      const url = `/api/goals/${goal._id}/milestones/${milestone._id}`;
      const renamed = await alice.patch(url).send({ title: 'Auth + sessions done' });
      expect(renamed.status).toBe(200);
      expect(goalOf(renamed).milestones[0].title).toBe('Auth + sessions done');

      const completed = await alice.patch(url).send({ done: true });
      expect(goalOf(completed).milestones[0].done).toBe(true);
      expect(goalOf(completed).milestones[0].completedAt).toBeTruthy();

      const reopened = await alice.patch(url).send({ done: false });
      expect(goalOf(reopened).milestones[0]).toMatchObject({ done: false, completedAt: null });

      const deleted = await alice.del(url);
      expect(deleted.status).toBe(200);
      expect(goalOf(deleted).milestones).toHaveLength(0);

      const again = await alice.del(url);
      expect(again.status).toBe(404);
    });

    it('records one activity event per completion, even when sent twice', async () => {
      const goal = await newGoal(alice, 'Learn system design');
      const added = await alice.post(`/api/goals/${goal._id}/milestones`).send({ title: 'Read DDIA ch. 1-3' });
      const url = `/api/goals/${goal._id}/milestones/${goalOf(added).milestones[0]._id}`;

      await Promise.all([alice.patch(url).send({ done: true }), alice.patch(url).send({ done: true })]);

      const activity = await alice.get('/api/activity?type=milestone_completed');
      const events = activity.body.data.items.filter(item => item.subjectId === goal._id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ title: 'Read DDIA ch. 1-3', detail: 'Goal: Learn system design', subjectType: 'goal', source: 'manual' });
    });

    it('validates input', async () => {
      const goal = await newGoal();
      const base = `/api/goals/${goal._id}/milestones`;

      expect((await alice.post(base).send({})).status).toBe(400);
      expect((await alice.post(base).send({ title: '   ' })).status).toBe(400);
      expect((await alice.post(base).send({ title: 'x'.repeat(121) })).status).toBe(400);
      expect((await alice.post(base).send({ title: 'ok', dueDate: '2026-02-30' })).status).toBe(400);
      expect((await alice.post(base).send({ title: 'ok', done: true })).status).toBe(400);
      expect((await alice.post(base).send({ title: 'ok', completedAt: '2026-01-01' })).status).toBe(400);

      const added = await alice.post(base).send({ title: 'ok' });
      const url = `${base}/${goalOf(added).milestones[0]._id}`;
      expect((await alice.patch(url).send({})).status).toBe(400);
      expect((await alice.patch(url).send({ done: 'yes' })).status).toBe(400);
      expect((await alice.patch(url).send({ completedAt: null })).status).toBe(400);
      expect((await alice.patch(`${base}/not-an-id`).send({ done: true })).status).toBe(400);
      expect((await alice.patch(`${base}/${new mongoose.Types.ObjectId()}`).send({ done: true })).status).toBe(404);
    });

    it('cannot be set through the goal create/update endpoints', async () => {
      const created = await alice.post('/api/goals').send({ title: 'Sneaky goal', milestones: [{ title: 'x', done: true }] });
      expect(created.status).toBe(201);
      expect(created.body.goal.milestones).toEqual([]);

      const updated = await alice.patch(`/api/goals/${created.body.goal._id}`).send({ milestones: [] });
      expect(updated.status).toBe(400);
    });

    it(`caps a goal at ${MAX_MILESTONES} milestones`, async () => {
      const goal = await newGoal();
      const milestones = Array.from({ length: MAX_MILESTONES }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), title: `m${i}` }));
      await Goal.updateOne({ _id: goal._id }, { $set: { milestones } });

      const response = await alice.post(`/api/goals/${goal._id}/milestones`).send({ title: 'one too many' });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('MILESTONE_LIMIT');
    });

    it('requires authentication and CSRF', async () => {
      const goal = await newGoal();
      const unauthenticated = await request(app).post(`/api/goals/${goal._id}/milestones`).send({ title: 'x' });
      expect(unauthenticated.status).toBe(401);

      const noCsrf = await request(app).post(`/api/goals/${goal._id}/milestones`).set('Cookie', alice.cookie()).send({ title: 'x' });
      expect(noCsrf.status).toBe(403);
    });

    it("never touches another user's goal", async () => {
      const goal = await newGoal();
      const added = await alice.post(`/api/goals/${goal._id}/milestones`).send({ title: 'Private' });
      const url = `/api/goals/${goal._id}/milestones/${goalOf(added).milestones[0]._id}`;

      expect((await mallory.post(`/api/goals/${goal._id}/milestones`).send({ title: 'x' })).status).toBe(404);
      expect((await mallory.patch(url).send({ done: true, title: 'hacked' })).status).toBe(404);
      expect((await mallory.del(url)).status).toBe(404);

      const stored = await Goal.findById(goal._id).lean();
      expect(stored.milestones).toHaveLength(1);
      expect(stored.milestones[0]).toMatchObject({ title: 'Private', done: false });
    });
  });

  describe('project milestones', () => {
    it('uses the project response envelope and records completion', async () => {
      const project = projectOf(await newProject());

      const added = await alice.post(`/api/projects/${project._id}/milestones`).send({ title: 'Deploy beta' });
      expect(added.status).toBe(201);
      expect(added.body.success).toBe(true);
      const milestoneId = projectOf(added).milestones[0]._id;

      const done = await alice.patch(`/api/projects/${project._id}/milestones/${milestoneId}`).send({ done: true });
      expect(projectOf(done).milestones[0].done).toBe(true);

      const activity = await alice.get('/api/activity?type=milestone_completed');
      expect(activity.body.data.items.some(item => item.subjectId === project._id && item.subjectType === 'project')).toBe(true);

      expect((await mallory.patch(`/api/projects/${project._id}/milestones/${milestoneId}`).send({ done: false })).status).toBe(404);
    });
  });

  describe('project ↔ goal link', () => {
    it('links a project to an owned goal and unlinks it', async () => {
      const goal = await newGoal(alice, 'Get a backend internship');
      const created = await newProject(alice, { goal: goal._id });
      expect(created.status).toBe(201);
      expect(projectOf(created).goal).toBe(goal._id);

      const unlinked = await alice.patch(`/api/projects/${projectOf(created)._id}`).send({ goal: null });
      expect(unlinked.status).toBe(200);
      expect(projectOf(unlinked).goal).toBeNull();
    });

    it("rejects another user's goal and malformed ids", async () => {
      const malloryGoal = await newGoal(mallory, 'Mallory goal');

      const foreign = await newProject(alice, { goal: malloryGoal._id });
      expect(foreign.status).toBe(400);
      expect(foreign.body.code).toBe('INVALID_LINK');

      const project = projectOf(await newProject());
      const foreignUpdate = await alice.patch(`/api/projects/${project._id}`).send({ goal: malloryGoal._id });
      expect(foreignUpdate.status).toBe(400);

      expect((await newProject(alice, { goal: 'nope' })).status).toBe(400);
      expect((await newProject(alice, { goal: { $ne: null } })).status).toBe(400);
    });

    it('unlinks projects when their goal is deleted', async () => {
      const goal = await newGoal(alice, 'Temporary goal');
      const project = projectOf(await newProject(alice, { goal: goal._id }));

      expect((await alice.del(`/api/goals/${goal._id}`)).status).toBe(200);

      const after = await alice.get(`/api/projects/${project._id}`);
      expect(after.status).toBe(200);
      expect(projectOf(after).goal).toBeNull();
    });
  });
});
