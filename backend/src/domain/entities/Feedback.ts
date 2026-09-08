import { CriterionResult } from './Criterion';
import { Evaluation } from './Evaluation';

/**
 * Feedback Entity
 * Aggregated view combining evaluations (deterministic + AI) for a single submission.
 * This is what the learner inspects, including criterion breakdown and whether AI was available.
 */
export interface Feedback {
  submissionId: string;
  deterministicEvaluation?: Evaluation;
  aiEvaluation?: Evaluation;
  combinedResults: CriterionResult[];
  overallSummary: string;
  aiAvailable: boolean;
  generatedAt: string;
}
