import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

function createUser() {
    const uniqueId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 7)}`;

    return {
        username: `auth_${uniqueId}`,
        email: `auth_${uniqueId}@example.com`,
        password: 'TestPassword123!'
    };
}

describe('Authentication API', () => {
    it('should register a new user', async () => {
        const user = createUser();

        const response = await request(app)
            .post('/api/auth/register')
            .send(user);

        expect(response.status).toBe(201);

        expect(response.body.message).toBe('Registration successful');

        expect(response.body.user).toBeDefined();
        expect(response.body.user.username).toBe(user.username);
        expect(response.body.user.email).toBe(user.email);
        expect(response.body.user.password).toBeUndefined();
    });

    it('should reject duplicate email registration', async () => {
        const user = createUser();

        const firstResponse = await request(app)
            .post('/api/auth/register')
            .send(user);

        expect(firstResponse.status).toBe(201);

        const secondResponse = await request(app)
            .post('/api/auth/register')
            .send(user);

        expect(secondResponse.status).toBe(409);
    });

    it('should reject invalid registration data', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'ab',
                email: 'not-an-email',
                password: '123'
            });

        expect(response.status).toBe(400);
    });

    it('should login an existing user', async () => {
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

        expect(loginResponse.body.message).toBe('Login Successful');

        expect(loginResponse.headers['set-cookie']).toBeDefined();
    });

    it('should reject invalid login credentials', async () => {
        const user = createUser();

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(user);

        expect(registerResponse.status).toBe(201);

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: user.email,
                password: 'WrongPassword123!'
            });

        expect(loginResponse.status).toBe(401);
    });

    it('should reject unauthenticated access to /me', async () => {
        const response = await request(app)
            .get('/api/auth/me');

        expect(response.status).toBe(401);
    });

    it('should allow an authenticated user to access /me', async () => {
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

        const meResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookies);

        expect(meResponse.status).toBe(200);
    });

    it('should logout an authenticated user', async () => {
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

        const logoutResponse = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

        expect(logoutResponse.status).toBe(200);
    });
});