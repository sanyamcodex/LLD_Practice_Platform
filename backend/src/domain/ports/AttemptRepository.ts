import { Attempt } from '../entities/Attempt';

export interface AttemptRepository {
  findById(id: string): Promise<Attempt | null>;
  findByLearnerId(learnerId: string): Promise<Attempt[]>;
  findByProblemId(problemId: string, learnerId?: string): Promise<Attempt[]>;
  save(attempt: Attempt): Promise<Attempt>;
  update(attempt: Attempt): Promise<Attempt>;
}
