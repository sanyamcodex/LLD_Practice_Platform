/**
 * Criterion Entity
 * A single evaluation dimension in a Low-Level Design rubric.
 */
export interface Criterion {
  key: string;
  label: string;
  description: string;
}

/**
 * CriterionResult
 * Fine-grained feedback for a specific criterion, grounded in concrete submission evidence.
 */
export interface CriterionResult {
  criterionKey: string;
  score: number; // 0 to 5
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number; // 0.0 to 1.0
}
