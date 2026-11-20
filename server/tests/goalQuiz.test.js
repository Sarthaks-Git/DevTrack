import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/ai/anthropic.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createMessage: vi.fn() };
});

import app from '../src/app.js';
import { createMessage } from '../src/services/ai/anthropic.transport.js';
import { parseQuiz, submitAttemptLogic } from '../src/services/goalQuiz.service.js';
import { refreshRemindersLogic } from '../src/services/notification.service.js';
import GoalQuiz from '../src/models/GoalQuiz.js';
import Notification from '../src/models/Notification.js';
import { createSession } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;

const question = (n, answer = 1) => ({
  prompt: `What does pattern number ${n} solve?`,
  options: [`Wrong A${n}`, `Right ${n}`, `Wrong C${n}`, `Wrong D${n}`],
  answer,
  explanation: `Because ${n}.`,
});
const QUIZ = { questions: [1, 2, 3, 4, 5].map(n => question(n)) };
const answer = data => ({ stop_reason: 'end_turn', usage: { input_tokens: 700, output_tokens: 600 }, content: [{ type: 'text', text: JSON.stringify(data) }] });

async function setup({ consent = true } = {}) {
  const s = await createSession('quiz');
  if (consent) await s.put('/api/ai/consent').send({ enabled: true });
  const created = await s.post('/api/goals').send({ title: 'Understand sliding window', description: 'Theory first' });
  return { s, goalId: created.body.goal._id };
}

// The right option's index after the server's shuffle, read from the stored quiz.
const rightAnswers = async (owner, goal) => (await GoalQuiz.findOne({ owner, goal }).lean()).questions.map(item => item.answer);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AI goal quiz', () => {
  it('creates a quiz without sending the answers to the browser', async () => {
    const { s, goalId } = await setup();
    createMessage.mockResolvedValueOnce(answer(QUIZ));
    const created = await s.post(`/api/goals/${goalId}/quiz`);
    expect(created.status).toBe(201);
    const { quiz } = created.body.data;
    expect(quiz.questions).toHaveLength(5);
    expect(quiz).toMatchObject({ stage: 0, reviews: 3, mastered: false, nextReviewAt: null, due: false });
    expect(JSON.stringify(created.body)).not.toMatch(/"answer"|explanation|Because/);
    expect(JSON.stringify((await s.get(`/api/goals/${goalId}/quiz`)).body)).not.toMatch(/"answer"|explanation/);
    expect(createMessage.mock.calls[0][0].messages[0].content).toMatch(/^<goal>.*<\/goal>$/);
  });

  it('scores attempts, reveals answers after, and schedules reviews at 3, 7 and 30 days', async () => {
    const { s, goalId } = await setup();
    createMessage.mockResolvedValueOnce(answer(QUIZ));
    await s.post(`/api/goals/${goalId}/quiz`);
    const right = await rightAnswers(s.userId, goalId);
    const wrong = right.map(value => (value + 1) % 4);

    const failed = await s.post(`/api/goals/${goalId}/quiz/attempts`).send({ answers: [right[0], ...wrong.slice(1)] });
    expect(failed.status).toBe(200);
    expect(failed.body.data).toMatchObject({ score: 1, total: 5, passed: false });
    expect(failed.body.data.results[1]).toMatchObject({ correct: false, answer: right[1], explanation: 'Because 2.' });
    expect(failed.body.data.quiz.stage).toBe(0);
    expect(new Date(failed.body.data.quiz.nextReviewAt).getTime()).toBeGreaterThan(Date.now() + 0.9 * DAY);

    const t0 = Date.now();
    const passes = [];
    for (const [offset, expectedDays] of [[0, 3], [3, 7], [10, 30], [40, null]]) {
      const result = await submitAttemptLogic(s.userId, goalId, right, { now: new Date(t0 + offset * DAY) });
      passes.push(result);
      expect(result.passed).toBe(true);
      if (expectedDays === null) expect(result.quiz.nextReviewAt).toBeNull();
      else expect(new Date(result.quiz.nextReviewAt).getTime()).toBe(t0 + (offset + expectedDays) * DAY);
    }
    expect(passes.map(result => result.quiz.stage)).toEqual([1, 2, 3, 4]);
    expect(passes[3].quiz.mastered).toBe(true);
    expect(passes[3].quiz.attempts.length).toBe(5);

    // Four of five right is a pass; skipped answers count as wrong.
    const skipped = await s.post(`/api/goals/${goalId}/quiz/attempts`).send({ answers: [...right.slice(0, 4), null] });
    expect(skipped.body.data).toMatchObject({ score: 4, passed: true });
  });

  it('reminds when a review is due, once per scheduled review', async () => {
    const { s, goalId } = await setup();
    createMessage.mockResolvedValueOnce(answer(QUIZ));
    await s.post(`/api/goals/${goalId}/quiz`);
    await GoalQuiz.updateOne({ owner: s.userId, goal: goalId }, { $set: { stage: 1, nextReviewAt: new Date(Date.now() - 1000) } });

    const today = new Date(new Date().toISOString().slice(0, 10));
    await refreshRemindersLogic(s.userId, today, { force: true });
    await refreshRemindersLogic(s.userId, today, { force: true });
    const reminders = await Notification.find({ owner: s.userId, type: 'quiz_review' }).lean();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toBe('Quiz review due: Understand sliding window');
    expect((await s.get(`/api/goals/${goalId}/quiz`)).body.data.quiz.due).toBe(true);
  });

  it('checks consent, ownership, CSRF and the attempt body', async () => {
    const { s, goalId } = await setup({ consent: false });
    expect((await s.post(`/api/goals/${goalId}/quiz`)).body.code).toBe('AI_CONSENT_REQUIRED');
    expect((await s.post(`/api/goals/${goalId}/quiz/attempts`).send({ answers: [0, 0, 0] })).status).toBe(404);
    expect((await request(app).post(`/api/goals/${goalId}/quiz`).set('Cookie', s.cookie())).status).toBe(403);

    await s.put('/api/ai/consent').send({ enabled: true });
    createMessage.mockResolvedValueOnce(answer(QUIZ));
    await s.post(`/api/goals/${goalId}/quiz`);
    for (const body of [{}, { answers: [0, 1] }, { answers: [0, 1, 2, 3, 4] }, { answers: [0, 1, 2, 3, '1'] }, { answers: [0, 1, 2, 3, 0], score: 5 }]) {
      expect((await s.post(`/api/goals/${goalId}/quiz/attempts`).send(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await s.post(`/api/goals/${goalId}/quiz/attempts`).send({ answers: [0, 1, 2] })).status).toBe(400);

    const other = await createSession('quiz_other');
    expect((await other.get(`/api/goals/${goalId}/quiz`)).status).toBe(404);
    expect((await other.post(`/api/goals/${goalId}/quiz/attempts`).send({ answers: [0, 0, 0, 0, 0] })).status).toBe(404);
  });

  it('deletes the quiz with its goal', async () => {
    const { s, goalId } = await setup();
    createMessage.mockResolvedValueOnce(answer(QUIZ));
    await s.post(`/api/goals/${goalId}/quiz`);
    await s.del(`/api/goals/${goalId}`);
    expect(await GoalQuiz.countDocuments({ goal: goalId })).toBe(0);
  });

  it('drops malformed questions, shuffles options and keeps the right answer attached', () => {
    const parsed = parseQuiz({
      questions: [
        question(1, 0),
        { ...question(2), options: ['a', 'b', 'c'] },
        { ...question(3), options: ['same', 'same', 'x', 'y'] },
        { ...question(4), answer: 7 },
        { ...question(5), prompt: 'short' },
        question(1, 0),
        { ...question(6, 3), prompt: 'Which ‮structure is LIFO?' },
      ],
    }, { random: max => max - 1 });
    expect(parsed).toHaveLength(2);
    for (const item of parsed) expect(item.options[item.answer]).toMatch(/^(Right|Wrong A1|Wrong D6)/);
    expect(parsed[0].options[parsed[0].answer]).toBe('Wrong A1');
    expect(parsed[1].prompt).toBe('Which structure is LIFO?');
    expect(parsed[1].options[parsed[1].answer]).toBe('Wrong D6');
  });
});
