import { CriterionResult } from './Criterion';

/**
 * Evaluation Entity
 * Output produced by an EvaluationStrategy for a given Submission.
 * An evaluation is immutable and stamped with the evaluator type.
 */
export type EvaluatorType = 'DETERMINISTIC' | 'AI';

export interface Evaluation {
  id: string;
  submissionId: string;
  evaluatorType: EvaluatorType;
  rubricResults: CriterionResult[];
  overallSummary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
