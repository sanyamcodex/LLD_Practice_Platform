import { Evaluation } from '../entities/Evaluation';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';
import { EvaluationRepository } from '../ports/EvaluationRepository';
import { SubmissionRepository } from '../ports/SubmissionRepository';
import { SubmissionStateMachine } from '../state/SubmissionStateMachine';
import { EvaluationStrategy } from './EvaluationStrategy';

export interface OrchestratorResult {
  submissionId: string;
  deterministicEvaluation: Evaluation;
  aiEvaluation?: Evaluation;
  aiAvailable: boolean;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * EvaluationOrchestrator
 *
 * Coordinates execution of pluggable EvaluationStrategy instances.
 * 1. Runs DeterministicEvaluator first (always).
 * 2. Runs AIRubricEvaluator (best-effort).
 * 3. Graceful Degradation (FR14): If AI fails, times out, or lacks credentials,
 *    orchestrator creates a placeholder AI evaluation marking "AI evaluation unavailable",
 *    persists the deterministic evaluation, and transitions submission to COMPLETED.
 *    Submissions NEVER get left stuck in EVALUATING!
 */
export class EvaluationOrchestrator {
  constructor(
    private readonly deterministicEvaluator: EvaluationStrategy,
    private readonly aiEvaluator: EvaluationStrategy | null,
    private readonly evaluationRepository: EvaluationRepository,
    private readonly submissionRepository: SubmissionRepository
  ) {}

  async evaluateSubmission(
    submission: Submission,
    problem: Problem,
    rubric: Rubric
  ): Promise<OrchestratorResult> {
    const stateMachine = new SubmissionStateMachine(submission.status);

    // Transition from SUBMITTED -> EVALUATING
    if (stateMachine.canTransitionTo('EVALUATING')) {
      stateMachine.transition('EVALUATING');
      await this.submissionRepository.updateStatus(submission.id, 'EVALUATING');
    }

    let deterministicEval: Evaluation | null = null;
    let aiEval: Evaluation | null = null;
    let aiAvailable = false;

    try {
      // 1. Always run Deterministic evaluation first
      deterministicEval = await this.deterministicEvaluator.evaluate(submission, problem, rubric);
      await this.evaluationRepository.save(deterministicEval);

      // 2. Best-effort AI evaluation
      if (this.aiEvaluator) {
        try {
          aiEval = await this.aiEvaluator.evaluate(submission, problem, rubric);
          await this.evaluationRepository.save(aiEval);
          aiAvailable = true;
        } catch (aiError: any) {
          console.warn(`[EvaluationOrchestrator] AI evaluator failed or timed out for submission ${submission.id}:`, aiError?.message || aiError);
          aiAvailable = false;

          // Create an explicit "AI evaluation unavailable" record so consumers see why AI wasn't attached
          aiEval = {
            id: `eval_ai_fallback_${Date.now()}`,
            submissionId: submission.id,
            evaluatorType: 'AI',
            rubricResults: rubric.criteria.map((c) => ({
              criterionKey: c.key,
              score: deterministicEval?.rubricResults.find((dr) => dr.criterionKey === c.key)?.score || 3,
              evidence: 'AI evaluation service temporarily unavailable or key unconfigured.',
              concern: 'Detailed semantic evaluation was skipped due to AI service timeout/fallback.',
              suggestion: 'Deterministic structural feedback is preserved above. Re-submit or retry when AI service is ready.',
              confidence: 0.0,
            })),
            overallSummary: 'AI evaluation unavailable. Deterministic structural audit preserved; submission completed successfully.',
            createdAt: new Date().toISOString(),
            metadata: {
              fallback: true,
              error: aiError?.message || 'AI service unavailable',
            },
          };
          await this.evaluationRepository.save(aiEval);
        }
      }

      // 3. Mark submission COMPLETED
      stateMachine.transition('COMPLETED');
      await this.submissionRepository.updateStatus(submission.id, 'COMPLETED');

      return {
        submissionId: submission.id,
        deterministicEvaluation: deterministicEval,
        aiEvaluation: aiEval || undefined,
        aiAvailable,
        status: 'COMPLETED',
      };
    } catch (fatalError: any) {
      console.error(`[EvaluationOrchestrator] Fatal error evaluating submission ${submission.id}:`, fatalError);
      if (stateMachine.canTransitionTo('FAILED')) {
        stateMachine.transition('FAILED');
        await this.submissionRepository.updateStatus(submission.id, 'FAILED', fatalError?.message);
      }
      return {
        submissionId: submission.id,
        deterministicEvaluation: deterministicEval || ({} as Evaluation),
        aiAvailable: false,
        status: 'FAILED',
        error: fatalError?.message,
      };
    }
  }
}
