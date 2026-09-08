import { Evaluation, EvaluatorType } from '../entities/Evaluation';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';

/**
 * EvaluationStrategy Interface (Strategy Pattern)
 * Defines the contract for all evaluator implementations.
 * Enables zero-coupling pluggability of new evaluation engines (e.g. rule linters,
 * AST inspectors, human reviewers, or alternate LLMs) without modifying the submission flow.
 */
export interface EvaluationStrategy {
  readonly type: EvaluatorType;
  evaluate(submission: Submission, problem: Problem, rubric: Rubric): Promise<Evaluation>;
}
