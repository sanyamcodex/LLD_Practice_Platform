import { describe, it, expect, vi } from 'vitest';
import { GeminiClient } from '../../backend/src/infrastructure/llm/GeminiClient';
import { Problem } from '../../backend/src/domain/entities/Problem';
import { Submission } from '../../backend/src/domain/entities/Submission';
import { STANDARD_LLD_RUBRIC } from '../../backend/src/domain/evaluation/rubric';

describe('GeminiClient: Model Strategy & Reliability (gemini-3.5-flash-lite -> gemini-3.6-flash)', () => {
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

  it('1. gemini-3.5-flash-lite succeeds on first attempt as primary evaluator', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify(validJsonResponse),
    });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 7000,
      fallbackTimeoutMs: 7000,
      baseBackoffMs: 10,
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
    expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
      })
    );
  });

  it('2. gemini-3.5-flash-lite returns 503 -> retry occurs with backoff and succeeds', async () => {
    const error503 = new Error('HTTP 503 UNAVAILABLE: Server temporarily overloaded.');
    (error503 as any).status = 503;

    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 7000,
      fallbackTimeoutMs: 7000,
      baseBackoffMs: 10,
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
    expect(result.modelUsed).toBe('gemini-3.5-flash-lite');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
  });

  it('3. gemini-3.5-flash-lite fails twice -> gemini-3.6-flash is invoked', async () => {
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
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 7000,
      fallbackTimeoutMs: 7000,
      baseBackoffMs: 10,
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
    expect(result.modelUsed).toBe('gemini-3.6-flash');
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
    expect(generateContent).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'gemini-3.6-flash' }));
  });

  it('4. gemini-3.6-flash succeeds after primary failure', async () => {
    const error429 = new Error('HTTP 429 RESOURCE_EXHAUSTED: Rate limit exceeded');
    (error429 as any).status = 429;

    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 7000,
      fallbackTimeoutMs: 7000,
      baseBackoffMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.modelUsed).toBe('gemini-3.6-flash');
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('5. both AI models fail -> throws so EvaluationOrchestrator can invoke deterministic evaluator', async () => {
    const error503 = new Error('HTTP 503 UNAVAILABLE');
    (error503 as any).status = 503;

    const generateContent = vi.fn().mockRejectedValue(error503);

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 7000,
      fallbackTimeoutMs: 7000,
      baseBackoffMs: 10,
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

  it('6. 429, 503, 408, 5xx are retried only within configured bounds (max 2 attempts on primary)', async () => {
    const errors = [
      Object.assign(new Error('429 rate limit'), { status: 429 }),
      Object.assign(new Error('408 request timeout'), { status: 408 }),
      Object.assign(new Error('502 bad gateway'), { status: 502 }),
      Object.assign(new Error('504 gateway timeout'), { status: 504 }),
    ];

    for (const transientErr of errors) {
      const generateContent = vi.fn().mockRejectedValue(transientErr);
      const client = new GeminiClient({
        primaryModel: 'gemini-3.5-flash-lite',
        fallbackModel: 'gemini-3.6-flash',
        primaryTimeoutMs: 500,
        fallbackTimeoutMs: 500,
        baseBackoffMs: 5,
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

      // Bounds check: exactly 2 attempts for primary + 1 attempt for fallback = 3 total
      expect(generateContent).toHaveBeenCalledTimes(3);
    }
  });

  it('7. 400, 401, 403 are not retried repeatedly; breaks to fallback immediately', async () => {
    const clientError401 = new Error('HTTP 401 UNAUTHORIZED: API_KEY_INVALID');
    (clientError401 as any).status = 401;

    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(clientError401) // Primary fails with 401 (should NOT retry attempt 2)
      .mockResolvedValueOnce({
        // Fallback succeeds
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      baseBackoffMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.modelUsed).toBe('gemini-3.6-flash');
    // Primary called only ONCE (no retry on 401), fallback called ONCE -> total 2 calls
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.6-flash' }));
  });

  it('Malformed response / invalid JSON does not retry same model; moves directly to fallback', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: 'Not valid JSON at all!' }) // Primary returns malformed JSON
      .mockResolvedValueOnce({
        // Fallback returns valid response
        text: JSON.stringify(validJsonResponse),
      });

    const client = new GeminiClient({
      primaryModel: 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.6-flash',
      primaryTimeoutMs: 500,
      fallbackTimeoutMs: 500,
      baseBackoffMs: 10,
      aiClient: {
        models: { generateContent },
      },
    });

    const result = await client.evaluateDesign({
      problem: mockProblem,
      submission: mockSubmission,
      rubric: STANDARD_LLD_RUBRIC,
    });

    expect(result.modelUsed).toBe('gemini-3.6-flash');
    // Exactly 1 call to primary (no retry for malformed JSON) + 1 call to fallback = 2 calls
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
