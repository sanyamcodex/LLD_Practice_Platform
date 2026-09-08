import crypto from 'crypto';
import { AttemptRepository } from '../domain/ports/AttemptRepository';
import { SubmissionRepository } from '../domain/ports/SubmissionRepository';
import { EvaluationRepository } from '../domain/ports/EvaluationRepository';
import { Submission } from '../domain/entities/Submission';
import { Feedback } from '../domain/entities/Feedback';
import { CriterionResult } from '../domain/entities/Criterion';
import { EvaluationQueue } from './EvaluationQueue';
import { AppError } from '../api/middleware/AppError';

export class SubmissionService {
  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly attemptRepository: AttemptRepository,
    private readonly evaluationRepository: EvaluationRepository,
    private readonly evaluationQueue: EvaluationQueue
  ) {}

  private computeContentHash(content: any): string {
    const raw = `${content.assumptions || ''}::${content.classesAndResponsibilities || ''}::${content.relationships || ''}::${content.extensibilityAnswer || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async submitAttempt(attemptId: string): Promise<Submission> {
    const attempt = await this.attemptRepository.findById(attemptId);
    if (!attempt) {
      throw AppError.notFound(`Attempt with ID '${attemptId}' does not exist.`);
    }

    const contentHash = this.computeContentHash(attempt.content);

    // FR10: Idempotency Check
    // If an identical content snapshot for this attempt has already been submitted
    // and is currently evaluating or completed, return that existing submission!
    const existing = await this.submissionRepository.findExistingNonFailed(attemptId, contentHash);
    if (existing) {
      return existing;
    }

    // Create immutable submission snapshot
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const submission: Submission = {
      id: submissionId,
      attemptId,
      contentSnapshot: { ...attempt.content },
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    };

    // Save submission and mark attempt as submitted
    await this.submissionRepository.save(submission, contentHash);
    attempt.status = 'SUBMITTED';
    await this.attemptRepository.update(attempt);

    // Enqueue background asynchronous evaluation (non-blocking)
    this.evaluationQueue.enqueue(submissionId);

    return submission;
  }

  async getSubmissionStatus(submissionId: string): Promise<{
    submission: Submission;
    feedback: Feedback | null;
  }> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw AppError.notFound(`Submission with ID '${submissionId}' not found.`);
    }

    if (submission.status !== 'COMPLETED') {
      return { submission, feedback: null };
    }

    // Load evaluations for completed submission (most recent per evaluator type)
    const evaluations = await this.evaluationRepository.findBySubmissionId(submissionId);
    const deterministicEval = [...evaluations].reverse().find((e) => e.evaluatorType === 'DETERMINISTIC');
    const aiEval = [...evaluations].reverse().find((e) => e.evaluatorType === 'AI');

    const aiAvailable = Boolean(aiEval && !aiEval.metadata?.fallback);

    // Merge criterion results: AI results take semantic priority when available; otherwise deterministic
    const combinedResults: CriterionResult[] = [];
    const baseList = aiAvailable && aiEval ? aiEval.rubricResults : (deterministicEval?.rubricResults || []);

    for (const res of baseList) {
      combinedResults.push(res);
    }

    const feedback: Feedback = {
      submissionId,
      deterministicEvaluation: deterministicEval,
      aiEvaluation: aiEval,
      combinedResults,
      overallSummary:
        aiAvailable && aiEval?.overallSummary
          ? aiEval.overallSummary
          : deterministicEval?.overallSummary || 'Evaluation complete.',
      aiAvailable,
      generatedAt: submission.completedAt || new Date().toISOString(),
    };

    return { submission, feedback };
  }

  /**
   * Re-evaluates an existing submission (e.g. if previous AI evaluation experienced 503 or transient failure)
   */
  async reevaluateSubmission(submissionId: string): Promise<Submission> {
    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw AppError.notFound(`Submission ${submissionId} not found`);
    }

    const updated = await this.submissionRepository.updateStatus(submissionId, 'SUBMITTED');
    this.evaluationQueue.enqueue(submissionId);

    return updated;
  }
}
