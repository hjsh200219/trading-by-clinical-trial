import { describe, it, expect } from 'vitest';
import { createServer } from '../../src/index.js';

describe('MCP Server', () => {
  it('creates server without throwing', () => {
    expect(() => createServer()).not.toThrow();
  });

  it('ping tool returns pong', async () => {
    const server = createServer();

    // _registeredTools is a plain object keyed by tool name.
    // Each entry exposes a .handler function that we invoke directly,
    // since the full MCP transport is unavailable in unit tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registeredTools: Record<string, any> = (server as any)._registeredTools;
    expect(registeredTools).toBeDefined();

    const pingTool = registeredTools['ping'];
    expect(pingTool).toBeDefined();

    const result = await pingTool.handler({}, {});
    expect(result.content[0].text).toBe('pong');
  });
});
