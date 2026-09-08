import { Problem } from '../entities/Problem';

export interface ProblemRepository {
  findAll(): Promise<Problem[]>;
  findById(id: string): Promise<Problem | null>;
  save(problem: Problem): Promise<void>;
  saveMany(problems: Problem[]): Promise<void>;
}
