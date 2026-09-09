import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createBackendApp } from '../../server';

describe('Diagnostic Endpoint: POST /api/debug/gemini', () => {
  let app: Express;
  const validDebugToken = 'lld-debug-token-2026';

  beforeAll(async () => {
    process.env.DEBUG_TOKEN = validDebugToken;
    app = await createBackendApp({ useStubAI: true });
  });

  it('1. Rejects requests without valid debug authorization header with 401', async () => {
    const res = await request(app)
      .post('/api/debug/gemini')
      .send({ model: 'gemini-3.5-flash-lite' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('2. Rejects requests with wrong token with 401', async () => {
    const res = await request(app)
      .post('/api/debug/gemini')
      .set('x-debug-token', 'wrong-token-value')
      .send({ model: 'gemini-3.5-flash-lite' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('3. Accepts requests with valid x-debug-token and returns diagnostic structure', async () => {
    // With GEMINI_API_KEY set in environment or mock
    const res = await request(app)
      .post('/api/debug/gemini')
      .set('x-debug-token', validDebugToken)
      .send({ model: 'gemini-3.5-flash-lite' });

    // Status will be 200 (if API key connects) or 500/408/etc with detailed error payload, never 401
    expect([200, 500, 408]).toContain(res.status);
    expect(res.body).toHaveProperty('model', 'gemini-3.5-flash-lite');
    expect(res.body).toHaveProperty('durationMs');
    expect(typeof res.body.durationMs).toBe('number');
  }, 25000);

  it('4. GET /api/debug/gemini also functions with authorization', async () => {
    const res = await request(app)
      .get('/api/debug/gemini')
      .set('x-debug-token', validDebugToken);

    expect([200, 500, 408]).toContain(res.status);
    expect(res.body).toHaveProperty('model', 'gemini-3.5-flash-lite');
  }, 25000);
});
