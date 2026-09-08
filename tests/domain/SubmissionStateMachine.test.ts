import { describe, it, expect } from 'vitest';
import {
  SubmissionStateMachine,
  InvalidStateTransitionError,
} from '../../backend/src/domain/state/SubmissionStateMachine';

describe('SubmissionStateMachine', () => {
  it('initializes with default status SUBMITTED', () => {
    const sm = new SubmissionStateMachine();
    expect(sm.getStatus()).toBe('SUBMITTED');
  });

  it('allows legal transition: SUBMITTED -> EVALUATING', () => {
    const sm = new SubmissionStateMachine('SUBMITTED');
    expect(sm.canTransitionTo('EVALUATING')).toBe(true);
    expect(sm.transition('EVALUATING')).toBe('EVALUATING');
    expect(sm.getStatus()).toBe('EVALUATING');
  });

  it('allows legal transition: EVALUATING -> COMPLETED', () => {
    const sm = new SubmissionStateMachine('EVALUATING');
    expect(sm.canTransitionTo('COMPLETED')).toBe(true);
    expect(sm.transition('COMPLETED')).toBe('COMPLETED');
    expect(sm.getStatus()).toBe('COMPLETED');
  });

  it('allows legal transition: EVALUATING -> FAILED', () => {
    const sm = new SubmissionStateMachine('EVALUATING');
    expect(sm.canTransitionTo('FAILED')).toBe(true);
    expect(sm.transition('FAILED')).toBe('FAILED');
    expect(sm.getStatus()).toBe('FAILED');
  });

  it('rejects illegal transition: SUBMITTED -> COMPLETED directly and throws InvalidStateTransitionError', () => {
    const sm = new SubmissionStateMachine('SUBMITTED');
    expect(sm.canTransitionTo('COMPLETED')).toBe(false);
    expect(() => sm.transition('COMPLETED')).toThrow(InvalidStateTransitionError);
  });

  it('rejects illegal transition: SUBMITTED -> FAILED directly', () => {
    const sm = new SubmissionStateMachine('SUBMITTED');
    expect(sm.canTransitionTo('FAILED')).toBe(false);
    expect(() => sm.transition('FAILED')).toThrow(InvalidStateTransitionError);
  });

  it('rejects transitions from terminal state COMPLETED', () => {
    const sm = new SubmissionStateMachine('COMPLETED');
    expect(sm.canTransitionTo('EVALUATING')).toBe(false);
    expect(sm.canTransitionTo('SUBMITTED')).toBe(false);
    expect(() => sm.transition('EVALUATING')).toThrow(InvalidStateTransitionError);
  });

  it('rejects transitions from terminal state FAILED', () => {
    const sm = new SubmissionStateMachine('FAILED');
    expect(sm.canTransitionTo('EVALUATING')).toBe(false);
    expect(sm.canTransitionTo('COMPLETED')).toBe(false);
    expect(() => sm.transition('COMPLETED')).toThrow(InvalidStateTransitionError);
  });

  it('static canTransition checks correctly without instantiation', () => {
    expect(SubmissionStateMachine.canTransition('SUBMITTED', 'EVALUATING')).toBe(true);
    expect(SubmissionStateMachine.canTransition('SUBMITTED', 'COMPLETED')).toBe(false);
    expect(SubmissionStateMachine.canTransition('EVALUATING', 'COMPLETED')).toBe(true);
    expect(SubmissionStateMachine.canTransition('EVALUATING', 'FAILED')).toBe(true);
    expect(SubmissionStateMachine.canTransition('COMPLETED', 'FAILED')).toBe(false);
  });
});
