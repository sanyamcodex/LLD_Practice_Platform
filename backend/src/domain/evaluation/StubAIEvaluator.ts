import { CriterionResult } from '../entities/Criterion';
import { Evaluation } from '../entities/Evaluation';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';
import { EvaluationStrategy } from './EvaluationStrategy';

/**
 * StubAIEvaluator
 * Implements EvaluationStrategy port.
 * Returns deterministic mock AI CriterionResult data. Used for testing, offline demo,
 * and proving the Strategy pattern allows seamless evaluator replacement.
 */
export class StubAIEvaluator implements EvaluationStrategy {
  public readonly type = 'AI' as const;

  async evaluate(submission: Submission, problem: Problem, rubric: Rubric): Promise<Evaluation> {
    const content = submission.contentSnapshot;

    const results: CriterionResult[] = [
      {
        criterionKey: 'requirement_understanding',
        score: 4,
        evidence: `Learner explicitly defined: "${content.assumptions.slice(0, 90)}..."`,
        concern: 'Did not explicitly scope high-concurrency peak load characteristics.',
        suggestion: 'Add peak throughput estimation to quantify read/write ratios.',
        confidence: 0.9,
      },
      {
        criterionKey: 'class_responsibilities',
        score: 4,
        evidence: `Extracted candidate classes from design: "${content.classesAndResponsibilities.slice(0, 90)}..."`,
        concern: 'Potential coupling if the manager class handles both persistence and pricing.',
        suggestion: 'Separate pricing logic into a distinct Strategy class.',
        confidence: 0.88,
      },
      {
        criterionKey: 'coupling_cohesion',
        score: 4,
        evidence: `Relationships specified: "${content.relationships.slice(0, 80)}..."`,
        concern: 'Direct dependency between coordinator and terminal entities.',
        suggestion: 'Use an event listener or observer for state updates.',
        confidence: 0.85,
      },
      {
        criterionKey: 'encapsulation_interfaces',
        score: 3,
        evidence: 'Interface declarations provided for primary domain interactions.',
        concern: 'Internal collections are exposed rather than unmodifiable views.',
        suggestion: 'Wrap entity lookups in immutable accessors to preserve encapsulation.',
        confidence: 0.85,
      },
      {
        criterionKey: 'abstraction_pattern_use',
        score: 4,
        evidence: 'Applied Strategy pattern for dynamic algorithm selection.',
        concern: 'No factory abstraction to shield client from instantiation details.',
        suggestion: 'Introduce a Factory Method for polymorphic entity creation.',
        confidence: 0.92,
      },
      {
        criterionKey: 'extensibility',
        score: 4,
        evidence: `Addressed future requirement: "${content.extensibilityAnswer.slice(0, 90)}..."`,
        concern: 'New payment or hardware device would require class modification if not wrapped in adapter.',
        suggestion: 'Implement Adapter pattern for third-party hardware or payment gateways.',
        confidence: 0.89,
      },
      {
        criterionKey: 'explanation_quality',
        score: 4,
        evidence: 'Comprehensive design sections covering structure, relationships, and trade-offs.',
        concern: 'Lacks explicit latency vs storage footprint discussion.',
        suggestion: 'Document memory trade-offs when caching active sessions.',
        confidence: 0.87,
      },
    ];

    return {
      id: `eval_stub_${Date.now()}`,
      submissionId: submission.id,
      evaluatorType: 'AI',
      rubricResults: results,
      overallSummary: `Solid object-oriented design for ${problem.title}. Demonstrates clear domain separation and graceful extensibility with minor coupling opportunities in manager classes.`,
      createdAt: new Date().toISOString(),
      metadata: {
        evaluator: 'StubAIEvaluator',
      },
    };
  }
}
