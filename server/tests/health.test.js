import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Health API', () => {
    it('should return a healthy response', async () => {
        const response = await request(app)
            .get('/api/health');

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            message: 'DevTrack API is healthy'
        });
    });
});