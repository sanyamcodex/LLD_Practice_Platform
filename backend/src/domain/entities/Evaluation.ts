import { CriterionResult } from './Criterion';
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
