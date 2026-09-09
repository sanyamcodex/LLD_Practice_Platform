import { Evaluation } from '../entities/Evaluation';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';
import { LLMClient } from '../ports/LLMClient';
import { EvaluationStrategy } from './EvaluationStrategy';

/**
 * AIRubricEvaluator
 * Implements EvaluationStrategy port.
 *
 * Calls the LLMClient port with a timeout and structured response verification.
 * Evaluates semantic judgment dimensions: responsibility assignment, coupling/cohesion,
 * interface encapsulation, pattern selection, extensibility reasoning, and trade-offs.
 */
export class AIRubricEvaluator implements EvaluationStrategy {
  public readonly type = 'AI' as const;

  constructor(
    private readonly llmClient: LLMClient,
    private readonly timeoutMs: number = 18000
  ) {}

  async evaluate(submission: Submission, problem: Problem, rubric: Rubric, parentSignal?: AbortSignal): Promise<Evaluation> {
    const internalController = new AbortController();

    const onParentAbort = () => {
      internalController.abort(parentSignal?.reason || new Error('Orchestrator cancelled evaluation'));
    };

    if (parentSignal) {
      if (parentSignal.aborted) {
        internalController.abort(parentSignal.reason || new Error('Orchestrator cancelled evaluation'));
      } else {
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }
    }

    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    timer = setTimeout(() => {
      timedOut = true;
      internalController.abort(new Error(`AI Evaluation timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);

    let response: any;
    try {
      response = await this.llmClient.evaluateDesign({
        submission,
        problem,
        rubric,
        signal: internalController.signal,
      });
    } catch (err: any) {
      if (timedOut || (internalController.signal.aborted && !parentSignal?.aborted)) {
        throw new Error(`AI Evaluation timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    }

    // Ensure all 7 rubric criteria have representation
    const results = response.results || [];
    for (const criterion of rubric.criteria) {
      if (!results.some((r: any) => r.criterionKey === criterion.key)) {
        results.push({
          criterionKey: criterion.key,
          score: 3,
          evidence: 'Section omitted or not explicitly addressed.',
          concern: 'Insufficient detail to evaluate this dimension fully.',
          suggestion: 'Provide explicit architectural reasoning for this criterion.',
          confidence: 0.5,
        });
      }
    }

    return {
      id: `eval_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      submissionId: submission.id,
      evaluatorType: 'AI',
      rubricResults: results,
      overallSummary: response.overallSummary || 'AI Rubric Evaluation completed.',
      createdAt: new Date().toISOString(),
      metadata: {
        model: response.modelUsed || 'gemini-3.5-flash-lite',
        evaluator: 'AIRubricEvaluator',
      },
    };
  }
}
