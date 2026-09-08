/**
 * Problem Entity
 * Represents an Low-Level Design problem seeded in the system.
 * Read-mostly, contains core requirements, constraints, and future-requirement prompts.
 */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  futureRequirements: string[];
  createdAt?: string;
  updatedAt?: string;
}
