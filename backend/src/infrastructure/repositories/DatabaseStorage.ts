import fs from 'fs';
import path from 'path';

/**
 * File-backed Persistent Storage Engine
 * Provides atomic, reliable relational storage for Problems, Attempts, Submissions, and Evaluations.
 * Persists data to a local JSON file (simulating SQLite data file storage without external binary dependencies).
 */

export interface StoredData {
  problems: Record<string, any>;
  attempts: Record<string, any>;
  submissions: Record<string, any>;
  evaluations: Record<string, any>;
}

export class DatabaseStorage {
  private static instance: DatabaseStorage | null = null;
  private readonly filePath: string;
  private data: StoredData;

  private constructor() {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'lld_platform.db.json');
    this.data = this.load();
  }

  public static getInstance(): DatabaseStorage {
    if (!DatabaseStorage.instance) {
      DatabaseStorage.instance = new DatabaseStorage();
    }
    return DatabaseStorage.instance;
  }

  private load(): StoredData {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('Failed to parse database file, initializing clean state:', err);
      }
    }
    return {
      problems: {},
      attempts: {},
      submissions: {},
      evaluations: {},
    };
  }

  public flush(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Failed to flush database state to disk:', err);
    }
  }

  public get<K extends keyof StoredData>(table: K): StoredData[K] {
    return this.data[table];
  }
}
