import { EventEmitter } from 'events';
import { EvaluationOrchestrator } from '../domain/evaluation/EvaluationOrchestrator';
import { STANDARD_LLD_RUBRIC } from '../domain/evaluation/rubric';
import { ProblemRepository } from '../domain/ports/ProblemRepository';
import { SubmissionRepository } from '../domain/ports/SubmissionRepository';
import { AttemptRepository } from '../domain/ports/AttemptRepository';

export interface EvaluationJob {
  submissionId: string;
}

/**
 * EvaluationQueue
 * In-process asynchronous job queue.
 * Satisfies NFR2 (non-blocking HTTP response) and NFR3 (worker errors do not crash main process).
 * Submissions are enqueued immediately, and background evaluation runs without delaying the client.
 * Features duplicate evaluation prevention for jobs already queued or actively evaluating.
 */
export class EvaluationQueue {
  private queue: EvaluationJob[] = [];
  private isProcessing = false;
  private emitter = new EventEmitter();
  private pendingJobIds = new Set<string>();
  private inFlightJobIds = new Set<string>();

  constructor(
    private readonly orchestrator: EvaluationOrchestrator,
    private readonly submissionRepository: SubmissionRepository,
    private readonly problemRepository: ProblemRepository,
    private readonly attemptRepository: AttemptRepository
  ) {
    this.emitter.on('job_enqueued', () => {
      this.processNext();
    });
  }

  public enqueue(submissionId: string): boolean {
    if (this.pendingJobIds.has(submissionId) || this.inFlightJobIds.has(submissionId)) {
      console.warn(`[EvaluationQueue] Duplicate enqueue ignored for submission ${submissionId}`);
      return false;
    }

    this.pendingJobIds.add(submissionId);
    this.queue.push({ submissionId });
    // Trigger asynchronous processing on next microtask
    setImmediate(() => {
      this.emitter.emit('job_enqueued');
    });
    return true;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();

    if (!job) {
      this.isProcessing = false;
      return;
    }

    this.pendingJobIds.delete(job.submissionId);
    this.inFlightJobIds.add(job.submissionId);

    try {
      const submission = await this.submissionRepository.findById(job.submissionId);
      if (!submission) {
        console.error(`[EvaluationQueue] Submission ${job.submissionId} not found`);
        return;
      }

      // Look up associated attempt to get problemId
      const attempt = await this.attemptRepository.findById(submission.attemptId);
      if (!attempt) {
        console.error(`[EvaluationQueue] Attempt ${submission.attemptId} not found for submission ${submission.id}`);
        return;
      }

      const problem = await this.problemRepository.findById(attempt.problemId);
      if (!problem) {
        console.error(`[EvaluationQueue] Problem ${attempt.problemId} not found for submission ${submission.id}`);
        return;
      }

      // Run orchestrator
      await this.orchestrator.evaluateSubmission(submission, problem, STANDARD_LLD_RUBRIC);
    } catch (err) {
      console.error(`[EvaluationQueue] Unexpected failure processing job ${job.submissionId}:`, err);
    } finally {
      this.inFlightJobIds.delete(job.submissionId);
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.processNext();
      }
    }
  }
}
