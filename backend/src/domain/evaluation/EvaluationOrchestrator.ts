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
 * 4. Duplicate Evaluation Protection: Submissions are evaluated exactly once unless
 *    explicitly re-submitted for reevaluation.
 */
export class EvaluationOrchestrator {
  private activeSubmissions = new Set<string>();

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
    // Duplicate evaluation protection: prevent concurrent evaluations for the same submission
    if (this.activeSubmissions.has(submission.id)) {
      console.warn(`[EvaluationOrchestrator] Duplicate evaluation prevented: Submission ${submission.id} is already actively evaluating.`);
      const evaluations = await this.evaluationRepository.findBySubmissionId(submission.id);
      const detEval = evaluations.find((e) => e.evaluatorType === 'DETERMINISTIC') || null;
      const aiEval = evaluations.find((e) => e.evaluatorType === 'AI') || null;
      return {
        submissionId: submission.id,
        deterministicEvaluation: detEval || ({} as Evaluation),
        aiEvaluation: aiEval || undefined,
        aiAvailable: Boolean(aiEval && !aiEval.metadata?.fallback),
        status: submission.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
      };
    }

    // Duplicate evaluation protection: if already COMPLETED and not re-submitted for reevaluation, skip
    const freshSubmission = await this.submissionRepository.findById(submission.id);
    if (freshSubmission && freshSubmission.status === 'COMPLETED') {
      console.warn(`[EvaluationOrchestrator] Duplicate evaluation prevented: Submission ${submission.id} is already COMPLETED.`);
      const evaluations = await this.evaluationRepository.findBySubmissionId(submission.id);
      const detEval = evaluations.find((e) => e.evaluatorType === 'DETERMINISTIC') || null;
      const aiEval = evaluations.find((e) => e.evaluatorType === 'AI') || null;
      return {
        submissionId: submission.id,
        deterministicEvaluation: detEval || ({} as Evaluation),
        aiEvaluation: aiEval || undefined,
        aiAvailable: Boolean(aiEval && !aiEval.metadata?.fallback),
        status: 'COMPLETED',
      };
    }

    this.activeSubmissions.add(submission.id);

    const stateMachine = new SubmissionStateMachine(freshSubmission?.status || submission.status);

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
      console.log(`[EvaluationOrchestrator] Running deterministic evaluator for submission ${submission.id}...`);
      deterministicEval = await this.deterministicEvaluator.evaluate(submission, problem, rubric);
      await this.evaluationRepository.save(deterministicEval);
      console.log(`[EvaluationOrchestrator] Deterministic evaluation completed for submission ${submission.id}.`);

      // 2. Best-effort AI evaluation
      if (this.aiEvaluator) {
        try {
          console.log(`[EvaluationOrchestrator] Starting AI evaluation for submission ${submission.id}...`);
          aiEval = await this.aiEvaluator.evaluate(submission, problem, rubric);
          await this.evaluationRepository.save(aiEval);
          aiAvailable = true;
          console.log(`[EvaluationOrchestrator] Final AI success: Attached AI evaluation to submission ${submission.id}.`);
        } catch (aiError: any) {
          console.warn(`[EvaluationOrchestrator] AI evaluator failed or timed out for submission ${submission.id}:`, aiError?.message || aiError);
          console.log(`[EvaluationOrchestrator] Deterministic evaluator invoked as fallback for submission ${submission.id} (FR14). Persisting deterministic evaluation and completing submission.`);
          aiAvailable = false;
          console.log(`[EvaluationOrchestrator] Final AI failure: AI evaluation marked unavailable for submission ${submission.id} (fallback record persisted).`);

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
    } finally {
      this.activeSubmissions.delete(submission.id);
    }
  }
}
