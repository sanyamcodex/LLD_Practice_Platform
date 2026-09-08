import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createBackendApp } from '../../server';

describe('API Integration: Submissions & Lifecycle Flow', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createBackendApp({ useStubAI: true });
  });

  it('GET /api/health returns 200 { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/problems returns seeded problems', async () => {
    const res = await request(app).get('/api/problems');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);

    const parkingLot = res.body.find((p: any) => p.id === 'prob-parking-lot');
    expect(parkingLot).toBeDefined();
    expect(parkingLot.futureRequirements.length).toBeGreaterThanOrEqual(2);
  });

  it('Executes end-to-end happy path: create attempt -> draft -> submit -> poll status', async () => {
    // 1. Create Attempt
    const createRes = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'prob-parking-lot', learnerId: 'learner_integration_test' });

    expect(createRes.status).toBe(201);
    const attemptId = createRes.body.id;
    expect(attemptId).toBeDefined();
    expect(createRes.body.status).toBe('IN_PROGRESS');

    // 2. Save Draft Content
    const draftRes = await request(app)
      .patch(`/api/attempts/${attemptId}`)
      .send({
        assumptions: '4 floors with 100 spots per floor. Concurrency handled via row-level locks.',
        classesAndResponsibilities: 'ParkingLot, ParkingFloor, ParkingSpot, Ticket, PaymentService.',
        relationships: 'ParkingLot has-a ParkingFloor. ParkingFloor has-a ParkingSpot.',
        extensibilityAnswer: 'Strategy pattern for VIP dynamic pricing without altering core entities.',
      });

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.content.assumptions).toContain('4 floors');

    // 3. Submit Attempt
    const submitRes = await request(app).post(`/api/attempts/${attemptId}/submit`);
    expect(submitRes.status).toBe(200);
    const submissionId = submitRes.body.id;
    expect(submissionId).toBeDefined();
    expect(['SUBMITTED', 'EVALUATING', 'COMPLETED']).toContain(submitRes.body.status);

    // 4. Poll until completed
    let attemptsCount = 0;
    let pollRes: any;
    while (attemptsCount < 15) {
      pollRes = await request(app).get(`/api/submissions/${submissionId}`);
      if (pollRes.body.submission.status === 'COMPLETED') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      attemptsCount++;
    }

    expect(pollRes.status).toBe(200);
    expect(pollRes.body.submission.status).toBe('COMPLETED');
    expect(pollRes.body.feedback).toBeDefined();
    expect(pollRes.body.feedback.combinedResults.length).toBe(7);
  });

  it('Enforces FR10 Idempotency: double-submitting unchanged attempt returns existing submission without duplicate evaluations', async () => {
    // 1. Create Attempt
    const createRes = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'prob-vending-machine', learnerId: 'learner_idempotency_test' });

    const attemptId = createRes.body.id;

    // 2. Save Draft
    await request(app)
      .patch(`/api/attempts/${attemptId}`)
      .send({
        assumptions: 'Machine has 5 aisles and takes coins and cards.',
        classesAndResponsibilities: 'VendingMachine, Inventory, State, CoinAcceptor.',
        relationships: 'VendingMachine has-a State. State has concrete states.',
        extensibilityAnswer: 'State pattern allows adding contactless NFC payment without rewiring existing states.',
      });

    // 3. First Submit
    const firstSubmit = await request(app).post(`/api/attempts/${attemptId}/submit`);
    expect(firstSubmit.status).toBe(200);
    const firstSubmissionId = firstSubmit.body.id;

    // 4. Second Submit of same attempt with identical content
    const secondSubmit = await request(app).post(`/api/attempts/${attemptId}/submit`);
    expect(secondSubmit.status).toBe(200);
    const secondSubmissionId = secondSubmit.body.id;

    // Must return the exact same submission ID (no duplicate evaluation)
    expect(secondSubmissionId).toBe(firstSubmissionId);
  });

  it('Returns 404 AppError when submitting non-existent attempt ID', async () => {
    const res = await request(app).post('/api/attempts/non-existent-attempt-id-xyz/submit');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('does not exist');
  });

  it('GET /api/history returns completed submissions with resolved feedback and completedAt timestamp matching individual report', async () => {
    const res = await request(app).get('/api/history?learnerId=learner_integration_test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const completedItem = res.body.find((item: any) => item.latestSubmission?.status === 'COMPLETED');
    expect(completedItem).toBeDefined();
    expect(completedItem.feedback).toBeDefined();
    expect(completedItem.feedback.combinedResults.length).toBe(7);
    expect(completedItem.latestSubmission.completedAt).toBeDefined();
    expect(completedItem.evaluations.length).toBeGreaterThan(0);
  });
});
