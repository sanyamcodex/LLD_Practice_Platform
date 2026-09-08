import { SubmissionStatus } from '../entities/Submission';

/**
 * Domain error for invalid state transitions
 */
export class InvalidStateTransitionError extends Error {
  constructor(public readonly currentStatus: SubmissionStatus, public readonly targetStatus: SubmissionStatus) {
    super(`Illegal state transition from ${currentStatus} to ${targetStatus}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * SubmissionStateMachine
 * Encodes legal transitions in the submission lifecycle:
 * SUBMITTED -> EVALUATING
 * EVALUATING -> COMPLETED
 * EVALUATING -> FAILED
 *
 * All other transitions are rejected and throw InvalidStateTransitionError.
 */
export class SubmissionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
    SUBMITTED: ['EVALUATING'],
    EVALUATING: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: [],
  };

  private currentStatus: SubmissionStatus;

  constructor(initialStatus: SubmissionStatus = 'SUBMITTED') {
    this.currentStatus = initialStatus;
  }

  public getStatus(): SubmissionStatus {
    return this.currentStatus;
  }

  public static canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
    const allowed = SubmissionStateMachine.VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  public canTransitionTo(targetStatus: SubmissionStatus): boolean {
    return SubmissionStateMachine.canTransition(this.currentStatus, targetStatus);
  }

  public transition(targetStatus: SubmissionStatus): SubmissionStatus {
    if (!this.canTransitionTo(targetStatus)) {
      throw new InvalidStateTransitionError(this.currentStatus, targetStatus);
    }
    this.currentStatus = targetStatus;
    return this.currentStatus;
  }
}
