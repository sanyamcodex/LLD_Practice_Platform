import { Attempt, AttemptContent } from '../domain/entities/Attempt';
import { AttemptRepository } from '../domain/ports/AttemptRepository';
import { ProblemRepository } from '../domain/ports/ProblemRepository';
import { AppError } from '../api/middleware/AppError';

export class AttemptService {
  constructor(
    private readonly attemptRepository: AttemptRepository,
    private readonly problemRepository: ProblemRepository
  ) {}

  async startAttempt(problemId: string, learnerId: string = 'learner_default'): Promise<Attempt> {
    const problem = await this.problemRepository.findById(problemId);
    if (!problem) {
      throw AppError.notFound(`Problem with ID '${problemId}' does not exist.`);
    }

    const newAttempt: Attempt = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      problemId,
      learnerId,
      status: 'IN_PROGRESS',
      content: {
        assumptions: '',
        classesAndResponsibilities: '',
        relationships: '',
        extensibilityAnswer: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.attemptRepository.save(newAttempt);
  }

  async saveDraft(
    attemptId: string,
    contentUpdate: Partial<AttemptContent>
  ): Promise<Attempt> {
    const attempt = await this.attemptRepository.findById(attemptId);
    if (!attempt) {
      throw AppError.notFound(`Attempt with ID '${attemptId}' not found.`);
    }

    attempt.content = {
      ...attempt.content,
      ...contentUpdate,
    };

    return this.attemptRepository.update(attempt);
  }

  async getAttempt(attemptId: string): Promise<Attempt> {
    const attempt = await this.attemptRepository.findById(attemptId);
    if (!attempt) {
      throw AppError.notFound(`Attempt with ID '${attemptId}' not found.`);
    }
    return attempt;
  }

  async getAttemptsByLearner(learnerId: string = 'learner_default'): Promise<Attempt[]> {
    return this.attemptRepository.findByLearnerId(learnerId);
  }

  async getAttemptsByProblem(problemId: string, learnerId: string = 'learner_default'): Promise<Attempt[]> {
    return this.attemptRepository.findByProblemId(problemId, learnerId);
  }
}
