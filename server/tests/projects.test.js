import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

function createUser(prefix = 'project') {
    const uniqueId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 7)}`;

    return {
        username: `${prefix}_${uniqueId}`,
        email: `${prefix}_${uniqueId}@example.com`,
        password: 'TestPassword123!',
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
            password: user.password,
        });

    expect(loginResponse.status).toBe(200);

    const cookies = loginResponse.headers['set-cookie'];

    expect(cookies).toBeDefined();

    return { user, cookies };
}

async function createProject(cookies, overrides = {}) {
    const projectData = {
        title: 'DevTrack Portfolio',
        description: 'A developer command center and portfolio.',
        status: 'in_progress',
        priority: 'high',
        technologies: ['React', 'Node.js', 'MongoDB'],
        githubUrl: 'https://github.com/example/devtrack',
        liveUrl: 'https://example.com/devtrack',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        ...overrides,
    };

    return request(app)
        .post('/api/projects')
        .set('Cookie', cookies)
        .send(projectData);
}

describe('Projects API', () => {
    // CREATE

    it('should allow an authenticated user to create a project', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.project).toBeDefined();
        expect(response.body.data.project.title).toBe('DevTrack Portfolio');
        expect(response.body.data.project.status).toBe('in_progress');
        expect(response.body.data.project.priority).toBe('high');
        expect(response.body.data.project.technologies).toEqual([
            'React',
            'Node.js',
            'MongoDB',
        ]);
    });

    it('should reject unauthenticated project creation', async () => {
        const response = await request(app)
            .post('/api/projects')
            .send({ title: 'Unauthorized Project' });

        expect(response.status).toBe(401);
    });

    it('should reject a project with a missing title', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/projects')
            .set('Cookie', cookies)
            .send({
                description: 'A project without a title',
            });

        expect(response.status).toBe(400);
    });

    it('should reject a title shorter than three characters', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            title: 'AB',
        });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid project status', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            status: 'invalid_status',
        });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid project priority', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            priority: 'urgent',
        });

        expect(response.status).toBe(400);
    });

    it('should reject unexpected fields during creation', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            owner: '507f1f77bcf86cd799439011',
            isAdmin: true,
        });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid GitHub URL', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            githubUrl: 'not-a-valid-url',
        });

        expect(response.status).toBe(400);
    });

    it('should reject a URL that does not use HTTP or HTTPS', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            githubUrl: 'javascript:alert(1)',
        });

        expect(response.status).toBe(400);
    });

    it('should reject an impossible start date', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            startDate: '2026-02-31',
        });

        expect(response.status).toBe(400);
    });

    it('should reject an end date earlier than the start date', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            startDate: '2026-12-31',
            endDate: '2026-01-01',
        });

        expect(response.status).toBe(400);
    });

    it('should allow optional URLs and dates to be empty', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await createProject(cookies, {
            githubUrl: '',
            liveUrl: '',
            startDate: null,
            endDate: null,
        });

        expect(response.status).toBe(201);
        expect(response.body.data.project.githubUrl).toBe('');
        expect(response.body.data.project.liveUrl).toBe('');
        expect(response.body.data.project.startDate).toBeNull();
        expect(response.body.data.project.endDate).toBeNull();
    });

    // READ: LIST PROJECTS

    it('should allow an authenticated user to retrieve their projects', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const response = await request(app)
            .get('/api/projects')
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.projects)).toBe(true);
        expect(response.body.data.projects).toHaveLength(1);
        expect(response.body.data.projects[0].title).toBe(
            'DevTrack Portfolio'
        );
    });

    it('should return an empty array when the user has no projects', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .get('/api/projects')
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.data.projects).toEqual([]);
    });

    it('should reject unauthenticated project listing', async () => {
        const response = await request(app).get('/api/projects');

        expect(response.status).toBe(401);
    });

    it('should not expose another user projects in the project list', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createProject(userA.cookies);

        expect(createResponse.status).toBe(201);

        const response = await request(app)
            .get('/api/projects')
            .set('Cookie', userB.cookies);

        expect(response.status).toBe(200);
        expect(response.body.data.projects).toEqual([]);
    });

    // READ: SINGLE PROJECT

    it('should allow a user to retrieve their own project', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.data.project._id).toBe(projectId);
        expect(response.body.data.project.title).toBe('DevTrack Portfolio');
    });

    it('should reject an invalid project ID', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .get('/api/projects/not-a-valid-id')
            .set('Cookie', cookies);

        expect(response.status).toBe(400);
    });

    it('should return 404 for a valid but nonexistent project ID', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .get('/api/projects/507f1f77bcf86cd799439011')
            .set('Cookie', cookies);

        expect(response.status).toBe(404);
    });

    it('should prevent one user from accessing another user project', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createProject(userA.cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', userB.cookies);

        expect(response.status).toBe(404);
    });

    // UPDATE

    it('should allow a user to update their own project', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', cookies)
            .send({
                title: 'DevTrack Updated',
                status: 'completed',
                priority: 'medium',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.project.title).toBe('DevTrack Updated');
        expect(response.body.data.project.status).toBe('completed');
        expect(response.body.data.project.priority).toBe('medium');
    });

    it('should reject an update with no fields', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', cookies)
            .send({});

        expect(response.status).toBe(400);
    });

    it('should reject unexpected fields during update', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', cookies)
            .send({
                title: 'Updated Project',
                owner: '507f1f77bcf86cd799439011',
            });

        expect(response.status).toBe(400);
    });

    it('should reject an invalid project ID during update', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .patch('/api/projects/not-a-valid-id')
            .set('Cookie', cookies)
            .send({ title: 'Updated Project' });

        expect(response.status).toBe(400);
    });

    it('should prevent one user from updating another user project', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createProject(userA.cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', userB.cookies)
            .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(404);

        const ownerResponse = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', userA.cookies);

        expect(ownerResponse.status).toBe(200);
        expect(ownerResponse.body.data.project.title).toBe(
            'DevTrack Portfolio'
        );
    });

    it('should reject an update that makes the date range invalid', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', cookies)
            .send({
                endDate: '2025-12-31',
            });

        expect(response.status).toBe(400);
    });

    it('should allow clearing project dates', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const response = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Cookie', cookies)
            .send({
                startDate: null,
                endDate: null,
            });

        expect(response.status).toBe(200);
        expect(response.body.data.project.startDate).toBeNull();
        expect(response.body.data.project.endDate).toBeNull();
    });

    // DELETE

    it('should allow a user to delete their own project', async () => {
        const { cookies } = await createAuthenticatedUser();

        const createResponse = await createProject(cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const deleteResponse = await request(app)
            .delete(`/api/projects/${projectId}`)
            .set('Cookie', cookies);

        expect(deleteResponse.status).toBe(200);

        const getResponse = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', cookies);

        expect(getResponse.status).toBe(404);
    });

    it('should reject an invalid project ID during deletion', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .delete('/api/projects/not-a-valid-id')
            .set('Cookie', cookies);

        expect(response.status).toBe(400);
    });

    it('should prevent one user from deleting another user project', async () => {
        const userA = await createAuthenticatedUser();
        const userB = await createAuthenticatedUser();

        const createResponse = await createProject(userA.cookies);

        expect(createResponse.status).toBe(201);

        const projectId = createResponse.body.data.project._id;

        const deleteResponse = await request(app)
            .delete(`/api/projects/${projectId}`)
            .set('Cookie', userB.cookies);

        expect(deleteResponse.status).toBe(404);

        const ownerResponse = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', userA.cookies);

        expect(ownerResponse.status).toBe(200);
    });

    it('should reject unauthenticated project deletion', async () => {
        const response = await request(app).delete(
            '/api/projects/507f1f77bcf86cd799439011'
        );

        expect(response.status).toBe(401);
    });
});
