// ============================================================
// Standalone Node Host - Simple signaling node
// ============================================================
import { config } from './config';
import { start } from './index';

// Override port for standalone mode if specified
const port = process.argv[2] ? parseInt(process.argv[2], 10) : config.port;

if (port) {
  config.port = port;
  console.log(`[NodeHost] Starting on port ${port}`);
}

start();
