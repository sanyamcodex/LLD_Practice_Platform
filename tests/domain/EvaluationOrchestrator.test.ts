import { describe, it, expect, vi } from 'vitest';
import { EvaluationOrchestrator } from '../../backend/src/domain/evaluation/EvaluationOrchestrator';
import { DeterministicEvaluator } from '../../backend/src/domain/evaluation/DeterministicEvaluator';
import { STANDARD_LLD_RUBRIC } from '../../backend/src/domain/evaluation/rubric';
import { Problem } from '../../backend/src/domain/entities/Problem';
import { Submission } from '../../backend/src/domain/entities/Submission';
import { EvaluationStrategy } from '../../backend/src/domain/evaluation/EvaluationStrategy';
import { EvaluationRepository } from '../../backend/src/domain/ports/EvaluationRepository';
import { SubmissionRepository } from '../../backend/src/domain/ports/SubmissionRepository';

describe('EvaluationOrchestrator: Reliability, Fallback & Duplicate Protection', () => {
  const mockProblem: Problem = {
    id: 'prob-elevator',
    title: 'Design Elevator System',
    difficulty: 'HARD',
    description: 'Design an elevator controller with dispatching algorithms.',
    futureRequirements: ['Support Destination Dispatching kiosks'],
  };

  const mockSubmission: Submission = {
    id: 'sub-test-1',
    attemptId: 'att-test-1',
    status: 'SUBMITTED',
    contentSnapshot: {
      assumptions: 'Standard 20 floors building with 4 cars.',
      classesAndResponsibilities: 'ElevatorCar, Dispatcher, Request, Floor.',
      relationships: 'Dispatcher controls ElevatorCar.',
      extensibilityAnswer: 'Strategy pattern for dispatching algorithm accommodates Destination Dispatching.',
    },
    createdAt: new Date().toISOString(),
  };

  function createMockRepos() {
    const savedEvaluations: any[] = [];
    const submissionStatusMap: Record<string, string> = { [mockSubmission.id]: 'SUBMITTED' };

    const mockEvaluationRepo: EvaluationRepository = {
      findById: vi.fn(async (id) => savedEvaluations.find((e) => e.id === id) || null),
      findBySubmissionId: vi.fn(async (subId) => savedEvaluations.filter((e) => e.submissionId === subId)),
      save: vi.fn(async (evaluation) => {
        savedEvaluations.push(evaluation);
        return evaluation;
      }),
    };

    const mockSubmissionRepo: SubmissionRepository = {
      findById: vi.fn(async (id) => ({ ...mockSubmission, status: submissionStatusMap[id] as any })),
      findByAttemptId: vi.fn(async () => [mockSubmission]),
      findByLearnerId: vi.fn(async () => [mockSubmission]),
      findExistingNonFailed: vi.fn(async () => null),
      save: vi.fn(async (sub) => sub),
      updateStatus: vi.fn(async (id, status) => {
        submissionStatusMap[id] = status;
        return { ...mockSubmission, status };
      }),
    };

    return { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap };
  }

  it('Scenario 4: Secondary model (gemini-3.6-flash) succeeds -> AI evaluation is persisted', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap } = createMockRepos();
    const deterministicEvaluator = new DeterministicEvaluator();

    const fallbackSuccessAI: EvaluationStrategy = {
      type: 'AI',
      evaluate: vi.fn().mockResolvedValue({
        id: 'eval_ai_mock_fallback',
        submissionId: mockSubmission.id,
        evaluatorType: 'AI',
        rubricResults: STANDARD_LLD_RUBRIC.criteria.map((c) => ({
          criterionKey: c.key,
          score: 4,
          evidence: 'Solid use of strategy pattern',
          concern: 'Single point of failure',
          suggestion: 'Decouple controller',
          confidence: 0.9,
        })),
        overallSummary: 'Evaluation provided by fallback model gemini-3.6-flash.',
        createdAt: new Date().toISOString(),
        metadata: {
          model: 'gemini-3.6-flash',
          evaluator: 'AIRubricEvaluator',
        },
      }),
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      fallbackSuccessAI,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    const result = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );

    expect(result.status).toBe('COMPLETED');
    expect(submissionStatusMap[mockSubmission.id]).toBe('COMPLETED');
    expect(result.aiAvailable).toBe(true);
    expect(result.aiEvaluation?.metadata?.model).toBe('gemini-3.6-flash');
    expect(savedEvaluations.some((e) => e.evaluatorType === 'AI' && e.metadata?.model === 'gemini-3.6-flash')).toBe(true);
  });

  it('Scenario 5: Both AI models fail -> deterministic evaluator is persisted and completes submission', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap } = createMockRepos();
    const deterministicEvaluator = new DeterministicEvaluator();

    const bothModelsFailedAI: EvaluationStrategy = {
      type: 'AI',
      evaluate: vi.fn().mockRejectedValue(new Error('All candidate AI models (gemini-3.5-flash-lite, gemini-3.6-flash) failed.')),
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      bothModelsFailedAI,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    const result = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );

    expect(result.status).toBe('COMPLETED');
    expect(submissionStatusMap[mockSubmission.id]).toBe('COMPLETED');
    expect(result.aiAvailable).toBe(false);
    expect(result.deterministicEvaluation).toBeDefined();
    expect(result.deterministicEvaluation.evaluatorType).toBe('DETERMINISTIC');
    expect(savedEvaluations.some((e) => e.evaluatorType === 'DETERMINISTIC')).toBe(true);

    const fallbackRecord = savedEvaluations.find((e) => e.evaluatorType === 'AI');
    expect(fallbackRecord).toBeDefined();
    expect(fallbackRecord.metadata?.fallback).toBe(true);
  });

  it('Scenario 8: AI timeout does not leave submission stuck in EVALUATING', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap } = createMockRepos();
    const deterministicEvaluator = new DeterministicEvaluator();

    const timingOutAI: EvaluationStrategy = {
      type: 'AI',
      evaluate: vi.fn().mockRejectedValue(new Error('AI Evaluation timed out after 18000ms')),
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      timingOutAI,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    const result = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );

    expect(result.status).toBe('COMPLETED');
    expect(submissionStatusMap[mockSubmission.id]).toBe('COMPLETED');
    expect(result.aiAvailable).toBe(false);
    expect(result.deterministicEvaluation).toBeDefined();
  });

  it('Scenario 9: Duplicate evaluation request for the same submission is prevented', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations } = createMockRepos();
    const deterministicEvaluator = new DeterministicEvaluator();
    const evaluateAiFn = vi.fn().mockResolvedValue({
      id: 'eval_ai_1',
      submissionId: mockSubmission.id,
      evaluatorType: 'AI',
      rubricResults: [],
      overallSummary: 'Complete.',
      createdAt: new Date().toISOString(),
    });

    const aiEvaluator: EvaluationStrategy = {
      type: 'AI',
      evaluate: evaluateAiFn,
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      aiEvaluator,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    // First evaluation run
    const result1 = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );
    expect(result1.status).toBe('COMPLETED');
    expect(evaluateAiFn).toHaveBeenCalledTimes(1);

    // Second evaluation run on completed submission without reevaluation reset
    const result2 = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );
    expect(result2.status).toBe('COMPLETED');
    // AI evaluator was NOT called again; duplicate evaluation prevented
    expect(evaluateAiFn).toHaveBeenCalledTimes(1);
  });

  it('Scenario 10: Explicit Retry AI Analysis still works after completion', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, submissionStatusMap } = createMockRepos();
    const deterministicEvaluator = new DeterministicEvaluator();
    const evaluateAiFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({
        id: 'eval_ai_retry_success',
        submissionId: mockSubmission.id,
        evaluatorType: 'AI',
        rubricResults: [],
        overallSummary: 'Retry successful.',
        createdAt: new Date().toISOString(),
      });

    const aiEvaluator: EvaluationStrategy = {
      type: 'AI',
      evaluate: evaluateAiFn,
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      aiEvaluator,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    // First run fails AI and completes with deterministic fallback
    const result1 = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );
    expect(result1.status).toBe('COMPLETED');
    expect(result1.aiAvailable).toBe(false);

    // Explicit user action: "Retry AI Analysis" updates status back to SUBMITTED
    submissionStatusMap[mockSubmission.id] = 'SUBMITTED';
    const retrySubmission = { ...mockSubmission, status: 'SUBMITTED' as const };

    const result2 = await orchestrator.evaluateSubmission(
      retrySubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );

    expect(result2.status).toBe('COMPLETED');
    expect(result2.aiAvailable).toBe(true);
    expect(result2.aiEvaluation?.overallSummary).toBe('Retry successful.');
    expect(evaluateAiFn).toHaveBeenCalledTimes(2);
  });
});
