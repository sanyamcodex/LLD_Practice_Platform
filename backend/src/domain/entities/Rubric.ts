import { Criterion } from './Criterion';

/**
 * Rubric Entity
 * A composite set of criteria used by evaluators to assess design submissions.
 */
export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: Criterion[];
}
