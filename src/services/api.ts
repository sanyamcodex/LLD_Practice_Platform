import {
  Problem,
  Attempt,
  AttemptContent,
  Submission,
  SubmissionResponse,
  HistoryItem,
  ProblemHistoryResponse,
} from '../types';

export const api = {
  async getProblems(): Promise<Problem[]> {
    const res = await fetch('/api/problems');
    if (!res.ok) throw new Error('Failed to fetch problems');
    return res.json();
  },

  async getProblem(id: string): Promise<Problem> {
    const res = await fetch(`/api/problems/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch problem ${id}`);
    return res.json();
  },

  async startAttempt(problemId: string, learnerId: string = 'learner_default'): Promise<Attempt> {
    const res = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, learnerId }),
    });
    if (!res.ok) throw new Error('Failed to start attempt');
    return res.json();
  },

  async getAttempt(id: string): Promise<Attempt> {
    const res = await fetch(`/api/attempts/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch attempt ${id}`);
    return res.json();
  },

  async saveDraft(attemptId: string, content: Partial<AttemptContent>): Promise<Attempt> {
    const res = await fetch(`/api/attempts/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    if (!res.ok) throw new Error('Failed to save draft');
    return res.json();
  },

  async submitAttempt(attemptId: string): Promise<Submission> {
    const res = await fetch(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to submit attempt');
    return res.json();
  },

  async getSubmissionStatus(submissionId: string): Promise<SubmissionResponse> {
    const res = await fetch(`/api/submissions/${submissionId}`);
    if (!res.ok) throw new Error(`Failed to fetch submission ${submissionId}`);
    return res.json();
  },

  async reevaluateSubmission(submissionId: string): Promise<void> {
    const res = await fetch(`/api/submissions/${submissionId}/reevaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to trigger re-evaluation for ${submissionId}`);
  },

  async getHistory(learnerId: string = 'learner_default'): Promise<HistoryItem[]> {
    const res = await fetch(`/api/history?learnerId=${encodeURIComponent(learnerId)}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async getProblemHistory(problemId: string, learnerId: string = 'learner_default'): Promise<ProblemHistoryResponse> {
    const res = await fetch(`/api/history/problems/${problemId}?learnerId=${encodeURIComponent(learnerId)}`);
    if (!res.ok) throw new Error(`Failed to fetch problem history for ${problemId}`);
    return res.json();
  },
};
