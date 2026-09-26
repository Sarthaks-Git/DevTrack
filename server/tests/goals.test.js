import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

function createUser(prefix = 'goal') {
    const uniqueId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 7)}`;

    return {
        username: `${prefix}_${uniqueId}`,
        email: `${prefix}_${uniqueId}@example.com`,
        password: 'TestPassword123!'
    };
}

async function createAuthenticatedUser() {
    const user = createUser();

    const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(user);

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
            email: user.email,
            password: user.password
        });

    expect(loginResponse.status).toBe(200);

    const cookies = loginResponse.headers['set-cookie'];

    expect(cookies).toBeDefined();

    return {
        user,
        cookies
    };
}

async function createGoal(cookies, overrides = {}) {
    const goalData = {
        title: 'Learn automated testing',
        description: 'Learn Vitest and Supertest',
        priority: 'high',
        status: 'in_progress',
        deadline: '2026-12-31',
        ...overrides
    };

    const response = await request(app)
        .post('/api/goals')
        .set('Cookie', cookies)
        .send(goalData);

    return response;
}

describe('Goals API', () => {

    it('should allow an authenticated user to create a goal', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createGoal(cookies);

        expect(response.status).toBe(201);

        expect(response.body.goal).toBeDefined();
        expect(response.body.goal.title).toBe('Learn automated testing');
        expect(response.body.goal.priority).toBe('high');
        expect(response.body.goal.status).toBe('in_progress');
    });

    it('should reject unauthenticated goal creation', async () => {
        const response = await request(app)
            .post('/api/goals')
            .send({
                title: 'Unauthorized Goal'
            });

        expect(response.status).toBe(401);
    });

    it('should reject invalid goal data', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/goals')
            .set('Cookie', cookies)
            .send({
                title: 'A',
                priority: 'invalid_priority'
            });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid deadline', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/goals')
            .set('Cookie', cookies)
            .send({
                title: 'Valid Goal',
                deadline: '2026-02-31'
            });

        expect(response.status).toBe(400);
    });

    it('should allow an authenticated user to get their goals', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const response = await request(app)
            .get('/api/goals')
            .set('Cookie', cookies);

        expect(response.status).toBe(200);

        expect(Array.isArray(response.body.goals)).toBe(true);
        expect(response.body.goals.length).toBe(1);
        expect(response.body.goals[0].title).toBe('Learn automated testing');
    });

    it('should return an empty array when the user has no goals', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .get('/api/goals')
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.goals).toEqual([]);
    });

    it('should allow a user to get one of their goals', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.goal._id).toBe(goalId);
        expect(response.body.goal.title).toBe('Learn automated testing');
    });

    it('should reject an invalid goal ID', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .get('/api/goals/not-a-valid-id')
            .set('Cookie', cookies);

        expect(response.status).toBe(400);
    });

    it('should return 404 for a valid but nonexistent goal ID', async () => {
        const { cookies } = await createAuthenticatedUser();

        const fakeGoalId = '507f1f77bcf86cd799439011';

        const response = await request(app)
            .get(`/api/goals/${fakeGoalId}`)
            .set('Cookie', cookies);

        expect(response.status).toBe(404);
    });

    it('should prevent one user from accessing another user\'s goal', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createGoal(userA.cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Cookie', userB.cookies);

        expect(response.status).toBe(404);
    });

    it('should allow a user to update their own goal', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .patch(`/api/goals/${goalId}`)
            .set('Cookie', cookies)
            .send({
                title: 'Master automated testing',
                priority: 'medium',
                status: 'completed'
            });

        expect(response.status).toBe(200);

        expect(response.body.goal.title).toBe('Master automated testing');
        expect(response.body.goal.priority).toBe('medium');
        expect(response.body.goal.status).toBe('completed');
    });

    it('should reject an update with no fields', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .patch(`/api/goals/${goalId}`)
            .set('Cookie', cookies)
            .send({});

        expect(response.status).toBe(400);
    });

    it('should reject invalid fields during goal update', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .patch(`/api/goals/${goalId}`)
            .set('Cookie', cookies)
            .send({
                title: 'Updated Goal',
                unknownField: 'should not be accepted'
            });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid goal ID during update', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .patch('/api/goals/not-a-valid-id')
            .set('Cookie', cookies)
            .send({
                title: 'Updated Goal'
            });

        expect(response.status).toBe(400);
    });

    it('should prevent one user from updating another user\'s goal', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createGoal(userA.cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .patch(`/api/goals/${goalId}`)
            .set('Cookie', userB.cookies)
            .send({
                title: 'Unauthorized Update'
            });

        expect(response.status).toBe(404);
    });

    it('should allow a user to clear their goal deadline', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const response = await request(app)
            .patch(`/api/goals/${goalId}`)
            .set('Cookie', cookies)
            .send({
                deadline: null
            });

        expect(response.status).toBe(200);
        expect(response.body.goal.deadline).toBeNull();
    });

    it('should allow a user to delete their own goal', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createGoal(cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const deleteResponse = await request(app)
            .delete(`/api/goals/${goalId}`)
            .set('Cookie', cookies);

        expect(deleteResponse.status).toBe(200);

        const getResponse = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Cookie', cookies);

        expect(getResponse.status).toBe(404);
    });

    it('should reject an invalid goal ID during deletion', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .delete('/api/goals/not-a-valid-id')
            .set('Cookie', cookies);

        expect(response.status).toBe(400);
    });

    it('should prevent one user from deleting another user\'s goal', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createGoal(userA.cookies);

        expect(createResponse.status).toBe(201);

        const goalId = createResponse.body.goal._id;

        const deleteResponse = await request(app)
            .delete(`/api/goals/${goalId}`)
            .set('Cookie', userB.cookies);

        expect(deleteResponse.status).toBe(404);

        const ownerGetResponse = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Cookie', userA.cookies);

        expect(ownerGetResponse.status).toBe(200);
    });

    it('should reject unauthenticated access to goals', async () => {
        const response = await request(app)
            .get('/api/goals');

        expect(response.status).toBe(401);
    });
});