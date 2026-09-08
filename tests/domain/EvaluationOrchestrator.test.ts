import { describe, it, expect, vi } from 'vitest';
import { EvaluationOrchestrator } from '../../backend/src/domain/evaluation/EvaluationOrchestrator';
import { DeterministicEvaluator } from '../../backend/src/domain/evaluation/DeterministicEvaluator';
import { STANDARD_LLD_RUBRIC } from '../../backend/src/domain/evaluation/rubric';
import { Problem } from '../../backend/src/domain/entities/Problem';
import { Submission } from '../../backend/src/domain/entities/Submission';
import { EvaluationStrategy } from '../../backend/src/domain/evaluation/EvaluationStrategy';
import { EvaluationRepository } from '../../backend/src/domain/ports/EvaluationRepository';
import { SubmissionRepository } from '../../backend/src/domain/ports/SubmissionRepository';

describe('EvaluationOrchestrator', () => {
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

  it('CRITICAL TEST: Resolves to COMPLETED with deterministic feedback when AI evaluator fails/times out (FR14)', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap } = createMockRepos();

    const deterministicEvaluator = new DeterministicEvaluator();

    // Failing AI Evaluator simulating API failure, timeout, or rate limiting
    const failingAIEvaluator: EvaluationStrategy = {
      type: 'AI',
      evaluate: vi.fn().mockRejectedValue(new Error('Gemini API 503 Service Unavailable / Rate Limit Exceeded')),
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      failingAIEvaluator,
      mockEvaluationRepo,
      mockSubmissionRepo
    );

    const result = await orchestrator.evaluateSubmission(
      mockSubmission,
      mockProblem,
      STANDARD_LLD_RUBRIC
    );

    // Assertions for Graceful Degradation:
    // 1. Must never remain stuck in EVALUATING
    expect(result.status).toBe('COMPLETED');
    expect(submissionStatusMap[mockSubmission.id]).toBe('COMPLETED');

    // 2. Deterministic evaluation was preserved and persisted
    expect(result.deterministicEvaluation).toBeDefined();
    expect(result.deterministicEvaluation.evaluatorType).toBe('DETERMINISTIC');
    expect(savedEvaluations.some((e) => e.evaluatorType === 'DETERMINISTIC')).toBe(true);

    // 3. AI available flag must be false
    expect(result.aiAvailable).toBe(false);

    // 4. An explicit fallback record was persisted indicating AI was unavailable
    const fallbackEval = savedEvaluations.find((e) => e.evaluatorType === 'AI');
    expect(fallbackEval).toBeDefined();
    expect(fallbackEval.overallSummary).toContain('AI evaluation unavailable');
  });

  it('Executes full happy-path when both Deterministic and AI evaluators succeed', async () => {
    const { mockEvaluationRepo, mockSubmissionRepo, savedEvaluations, submissionStatusMap } = createMockRepos();

    const deterministicEvaluator = new DeterministicEvaluator();

    const successfulAIEvaluator: EvaluationStrategy = {
      type: 'AI',
      evaluate: vi.fn().mockResolvedValue({
        id: 'eval_ai_mock',
        submissionId: mockSubmission.id,
        evaluatorType: 'AI',
        rubricResults: STANDARD_LLD_RUBRIC.criteria.map((c) => ({
          criterionKey: c.key,
          score: 5,
          evidence: 'Concrete evidence from design',
          concern: '',
          suggestion: 'Minor optimization',
          confidence: 0.95,
        })),
        overallSummary: 'High-quality design with clean decoupling.',
        createdAt: new Date().toISOString(),
      }),
    };

    const orchestrator = new EvaluationOrchestrator(
      deterministicEvaluator,
      successfulAIEvaluator,
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
    expect(result.aiEvaluation?.overallSummary).toBe('High-quality design with clean decoupling.');
    expect(savedEvaluations.length).toBe(2);
  });
});
