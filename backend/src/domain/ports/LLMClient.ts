import { CriterionResult } from '../entities/Criterion';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';

export interface LLMClientEvaluationRequest {
  problem: Problem;
  submission: Submission;
  rubric: Rubric;
}

export interface LLMClientEvaluationResponse {
  results: CriterionResult[];
  overallSummary: string;
}

export interface LLMClient {
  evaluateDesign(request: LLMClientEvaluationRequest): Promise<LLMClientEvaluationResponse>;
}
