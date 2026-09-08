import { CriterionResult } from '../entities/Criterion';
import { Evaluation } from '../entities/Evaluation';
import { Problem } from '../entities/Problem';
import { Rubric } from '../entities/Rubric';
import { Submission } from '../entities/Submission';
import { EvaluationStrategy } from './EvaluationStrategy';

/**
 * DeterministicEvaluator
 * Implements EvaluationStrategy port.
 *
 * Fast, synchronous-feeling structural evaluator with zero external dependencies.
 * Checks:
 * 1. Structural completeness of all 4 fields (assumptions, classes, relationships, extensibility)
 * 2. Class identification: minimum distinct PascalCase classes / interfaces declared
 * 3. Future requirement addressing: whether the extensibility prompt was genuinely addressed
 * 4. Relationship clarity: presence of inheritance, composition, aggregation, or association keywords
 */
export class DeterministicEvaluator implements EvaluationStrategy {
  public readonly type = 'DETERMINISTIC' as const;

  async evaluate(submission: Submission, problem: Problem, rubric: Rubric): Promise<Evaluation> {
    const content = submission.contentSnapshot;
    const assumptions = (content.assumptions || '').trim();
    const classes = (content.classesAndResponsibilities || '').trim();
    const relationships = (content.relationships || '').trim();
    const extensibility = (content.extensibilityAnswer || '').trim();

    // 1. Identify distinct classes/interfaces using PascalCase patterns
    const classMatches = classes.match(/\b[A-Z][a-zA-Z0-9_]{2,}\b/g) || [];
    const uniqueClasses = Array.from(new Set(classMatches)).filter(
      (c) => !['String', 'Integer', 'Boolean', 'List', 'Map', 'Set', 'Void', 'Null', 'Array', 'Date', 'Type'].includes(c)
    );

    // 2. Analyze relationship semantics
    const relKeywords = ['has-a', 'is-a', 'implements', 'extends', 'composition', 'aggregation', 'association', '1:n', 'n:m', 'one-to-many', 'many-to-one', 'interface', 'abstract'];
    const lowerRel = relationships.toLowerCase();
    const matchedRelKeywords = relKeywords.filter((kw) => lowerRel.includes(kw));

    // 3. Extensibility analysis
    const hasExtensibilityAnswer = extensibility.length >= 40;
    const mentionsFutureReq = problem.futureRequirements.some((fr) => {
      const words = fr.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      return words.some((w) => extensibility.toLowerCase().includes(w));
    });

    const results: CriterionResult[] = [];

    // Criterion 1: Requirement Understanding
    const hasAssumptions = assumptions.length >= 30;
    const reqScore = !assumptions ? 1 : hasAssumptions ? 4 : 2;
    results.push({
      criterionKey: 'requirement_understanding',
      score: reqScore,
      evidence: assumptions ? `Provided assumptions (${assumptions.length} chars): "${assumptions.slice(0, 100)}..."` : 'No assumptions provided.',
      concern: !hasAssumptions ? 'Assumptions are either absent or too sparse to scope functional boundaries.' : '',
      suggestion: !hasAssumptions ? 'Document explicit assumptions about concurrency, scale, and operational constraints.' : 'Maintain stated assumptions when specifying class contracts.',
      confidence: 0.9,
    });

    // Criterion 2: Class Responsibilities & SRP
    const classCount = uniqueClasses.length;
    let classScore = 1;
    let classConcern = 'No distinct classes or responsibilities identified.';
    let classSuggestion = 'Decompose the problem into separate classes with single responsibilities.';

    if (classCount >= 4) {
      classScore = 4;
      classConcern = '';
      classSuggestion = 'Ensure responsibility assignments do not couple business logic with data storage.';
    } else if (classCount >= 2) {
      classScore = 3;
      classConcern = `Only ${classCount} distinct classes identified (${uniqueClasses.join(', ')}). Potential God class smell.`;
      classSuggestion = 'Split monolithic classes into specialized domain entities, managers, and value objects.';
    }

    results.push({
      criterionKey: 'class_responsibilities',
      score: classScore,
      evidence: `Identified ${classCount} distinct candidate classes: [${uniqueClasses.slice(0, 8).join(', ')}]. Content length: ${classes.length} characters.`,
      concern: classConcern,
      suggestion: classSuggestion,
      confidence: 0.85,
    });

    // Criterion 3: Coupling & Cohesion
    let couplingScore = 2;
    if (matchedRelKeywords.length >= 3 && classCount >= 3) {
      couplingScore = 4;
    } else if (matchedRelKeywords.length >= 1) {
      couplingScore = 3;
    }
    results.push({
      criterionKey: 'coupling_cohesion',
      score: couplingScore,
      evidence: `Relationships section (${relationships.length} chars). Detected relationship semantics: [${matchedRelKeywords.join(', ') || 'none'}].`,
      concern: matchedRelKeywords.length === 0 ? 'Lacks explicit relationship types (e.g. composition vs aggregation).' : '',
      suggestion: 'Favor composition over inheritance to decouple runtime behavior from compile-time hierarchies.',
      confidence: 0.8,
    });

    // Criterion 4: Encapsulation & Interfaces
    const mentionsInterfaces = /interface|abstract|contract|implements|getter|setter|private|public/i.test(classes + relationships);
    const encScore = mentionsInterfaces ? 4 : 2;
    results.push({
      criterionKey: 'encapsulation_interfaces',
      score: encScore,
      evidence: mentionsInterfaces ? 'Explicitly mentions interface/abstract contracts in class definitions.' : 'No explicit interface or contract abstractions found in class list.',
      concern: !mentionsInterfaces ? 'Concrete classes directly referenced without abstraction barriers.' : '',
      suggestion: 'Program to interfaces (e.g., IParkingStrategy, PaymentProcessor) to isolate implementations.',
      confidence: 0.8,
    });

    // Criterion 5: Abstraction & Design Pattern Selection
    const patterns = ['strategy', 'factory', 'observer', 'singleton', 'state', 'command', 'decorator', 'adapter', 'facade'];
    const detectedPatterns = patterns.filter((p) => (classes + relationships + extensibility).toLowerCase().includes(p));
    results.push({
      criterionKey: 'abstraction_pattern_use',
      score: detectedPatterns.length > 0 ? 4 : 2,
      evidence: detectedPatterns.length > 0 ? `Detected design pattern keywords: [${detectedPatterns.join(', ')}].` : 'No standard design patterns explicitly stated.',
      concern: detectedPatterns.length === 0 ? 'Design may be rigid procedural code wrapped in classes without structural patterns.' : '',
      suggestion: detectedPatterns.length === 0 ? 'Consider introducing appropriate behavioral patterns (like Strategy for pluggable algorithms or State for lifecycles).' : 'Verify that selected patterns genuinely solve requirement flexibility rather than adding accidental complexity.',
      confidence: 0.8,
    });

    // Criterion 6: Extensibility & Future Requirements
    let extScore = 1;
    let extConcern = 'Extensibility question was left blank or under 40 characters.';
    let extSuggestion = 'Detail how the design responds to the stated future requirements without modifying core classes (Open-Closed Principle).';

    if (hasExtensibilityAnswer) {
      extScore = mentionsFutureReq ? 4 : 3;
      extConcern = !mentionsFutureReq ? 'Extensibility response does not clearly cross-reference the problem’s stated future requirements.' : '';
      extSuggestion = 'Specify concrete interface additions or Strategy patterns that absorb the change.';
    }

    results.push({
      criterionKey: 'extensibility',
      score: extScore,
      evidence: hasExtensibilityAnswer ? `Extensibility analysis (${extensibility.length} chars): "${extensibility.slice(0, 200)}..."` : 'Extensibility section empty or insufficient.',
      concern: extConcern,
      suggestion: extSuggestion,
      confidence: 0.9,
    });

    // Criterion 7: Explanation Quality & Rationale
    const totalChars = assumptions.length + classes.length + relationships.length + extensibility.length;
    const expScore = totalChars > 600 ? 4 : totalChars > 250 ? 3 : 2;
    results.push({
      criterionKey: 'explanation_quality',
      score: expScore,
      evidence: `Total structured design artifact: ${totalChars} characters across all 4 mandatory sections.`,
      concern: totalChars < 300 ? 'Concise to the point of omitting trade-offs and structural rationale.' : '',
      suggestion: 'Articulate why particular trade-offs were chosen (e.g. why enum vs strategy, why in-memory lock vs queue).',
      confidence: 0.85,
    });

    const averageScore = (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1);

    return {
      id: `eval_det_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      submissionId: submission.id,
      evaluatorType: 'DETERMINISTIC',
      rubricResults: results,
      overallSummary: `Deterministic Structural Audit complete (${averageScore}/5.0 avg). Verified 4 sections, ${uniqueClasses.length} candidate classes, and extensibility coverage.`,
      createdAt: new Date().toISOString(),
      metadata: {
        uniqueClassesCount: uniqueClasses.length,
        matchedRelKeywords,
        hasExtensibilityAnswer,
        totalLength: totalChars,
      },
    };
  }
}
