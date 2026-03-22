import { describe, it, expect } from 'vitest';

describe('MCP Server', () => {
  it('should export createServer function', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.createServer).toBeDefined();
    expect(typeof mod.createServer).toBe('function');
  });

  it('should create a server with correct name and version', async () => {
    const { createServer } = await import('../../src/index.js');
    const server = createServer();
    expect(server).toBeDefined();
  });
});
