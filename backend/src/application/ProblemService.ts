import { Problem } from '../domain/entities/Problem';
import { ProblemRepository } from '../domain/ports/ProblemRepository';
import { AppError } from '../api/middleware/AppError';

export class ProblemService {
  constructor(private readonly problemRepository: ProblemRepository) {}

  async listProblems(): Promise<Problem[]> {
    return this.problemRepository.findAll();
  }

  async getProblemById(id: string): Promise<Problem> {
    const problem = await this.problemRepository.findById(id);
    if (!problem) {
      throw AppError.notFound(`Problem with ID '${id}' not found`);
    }
    return problem;
  }
}
