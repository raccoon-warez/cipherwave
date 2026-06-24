// Test setup
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

// Increase test timeout
const originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: Function, timeout: number) => {
  return originalTimeout(fn, timeout * 2);
}) as typeof globalThis.setTimeout;
