import dotenv from 'dotenv';
import path from 'path';

// Load root .env or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-key-change-in-production-lms-ai-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-jwt-secret-key-change-in-production-lms-ai-2026',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    user: process.env.DB_USER || 'lms_admin',
    password: process.env.DB_PASSWORD || 'lms_dev_password',
    database: process.env.DB_NAME || 'lms_ai_db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
  },
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
};
