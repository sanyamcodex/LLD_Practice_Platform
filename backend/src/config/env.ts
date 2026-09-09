import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  geminiApiKey: string;
  appUrl: string;
  allowedOrigin: string;
}

export const config: AppConfig = {
  port: process.env.NODE_ENV === 'production' && process.env.PORT && process.env.PORT !== '8080'
    ? parseInt(process.env.PORT, 10)
    : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
};
