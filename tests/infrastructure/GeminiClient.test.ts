import { describe, it, expect, vi } from 'vitest';
import { GeminiClient } from '../../backend/src/infrastructure/llm/GeminiClient';
import { Problem } from '../../backend/src/domain/entities/Problem';
import { Submission } from '../../backend/src/domain/entities/Submission';
import { STANDARD_LLD_RUBRIC } from '../../backend/src/domain/evaluation/rubric';

describe('GeminiClient Model Order & Retry/Fallback Behavior', () => {
  const mockProblem: Problem = {
    id: 'prob-1',
    title: 'Design Rate Limiter',
    difficulty: 'MEDIUM',
    description: 'Design a distributed rate limiter.',
    futureRequirements: ['Support token bucket and sliding window'],
  };

  const mockSubmission: Submission = {
    id: 'sub-1',
    attemptId: 'att-1',
    status: 'SUBMITTED',
    contentSnapshot: {
      assumptions: '10k requests per second.',
      classesAndResponsibilities: 'RateLimiter, TokenBucketStrategy.',
      relationships: 'RateLimiter uses TokenBucketStrategy.',
      extensibilityAnswer: 'Strategy pattern accommodates sliding window.',
    },
    createdAt: new Date().toISOString(),
  };

  const validJsonResponse = {
    overallSummary: 'Solid design using Strategy pattern.',
    results: STANDARD_LLD_RUBRIC.criteria.map((c) => ({
      criterionKey: c.key,
      score: 4,
      evidence: 'Uses Strategy pattern for TokenBucketStrategy.',
      concern: 'No distributed lock mentioned.',
      suggestion: 'Add Redis-backed atomic increment.',
      confidence: 0.9,
    })),
  };

  it('Scenario 1: Primary model succeeds on first attempt', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify(validJsonResponse),
    });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.7-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      backoffBaseMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.overallSummary).toBe('Solid design using Strategy pattern.');
    expect(result.modelUsed).toBe('gemini-3.8-flash');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.8-flash',
      })
    );
  });

  it('Scenario 2: HTTP 503 triggers retry with backoff on primary model, and retry succeeds', async () => {
    const error503 = new Error('HTTP 503 UNAVAILABLE: This model is currently experiencing high demand.');
    (error503 as any).status = 503;

    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.7-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      backoffBaseMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.overallSummary).toBe('Solid design using Strategy pattern.');
    expect(result.modelUsed).toBe('gemini-3.8-flash');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.8-flash' }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.8-flash' }));
  });

  it('Scenario 3: Primary model fails both attempts, fallback model (gemini-3.7-flash) succeeds', async () => {
    const error503 = new Error('HTTP 503 UNAVAILABLE');
    (error503 as any).status = 503;

    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(error503) // Attempt 1 primary
      .mockRejectedValueOnce(error503) // Attempt 2 primary
      .mockResolvedValueOnce({
        // Attempt 1 fallback
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.7-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      backoffBaseMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.overallSummary).toBe('Solid design using Strategy pattern.');
    expect(result.modelUsed).toBe('gemini-3.7-flash');
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.8-flash' }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.8-flash' }));
    expect(generateContent).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'gemini-3.7-flash' }));
  });

  it('Scenario 4: All candidate models fail => error is thrown with bounded attempts (does not retry indefinitely)', async () => {
    const error503 = new Error('HTTP 503 UNAVAILABLE');
    (error503 as any).status = 503;

    const generateContent = vi.fn().mockRejectedValue(error503);

    const client = new GeminiClient({
      primaryModel: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.7-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      backoffBaseMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    await expect(
      client.evaluateDesign({
        problem: mockProblem,
        submission: mockSubmission,
        rubric: STANDARD_LLD_RUBRIC,
      })
    ).rejects.toThrow();

    // Exactly 2 attempts on primary + 1 attempt on fallback = 3 calls total
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('Scenario 5: Timeout does not block indefinitely and falls back cleanly', async () => {
    // Hanging promise simulating stalled network
    const hangingPromise = () => new Promise<any>(() => {});

    const generateContent = vi
      .fn()
      .mockImplementationOnce(hangingPromise) // Primary attempt 1 hangs -> times out
      .mockImplementationOnce(hangingPromise) // Primary attempt 2 hangs -> times out
      .mockResolvedValueOnce({
        // Fallback succeeds
        text: JSON.stringify(validJsonResponse),
      });

    const startTime = Date.now();
    const client = new GeminiClient({
      primaryModel: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.7-flash',
      primaryTimeoutMs: 50, // Short timeout for test
      fallbackTimeoutMs: 50,
      backoffBaseMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    const duration = Date.now() - startTime;
    expect(result.modelUsed).toBe('gemini-3.7-flash');
    expect(generateContent).toHaveBeenCalledTimes(3);
    // Completes rapidly without hanging indefinitely
    expect(duration).toBeLessThan(1000);
  });
});
