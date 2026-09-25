// Decouples tool definitions from the chat router — ported from ng-chat's
// packages/chat-server/src/tools/registry.ts.
import type { Tool } from 'ai';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(name: string, tool: Tool): this {
    this.tools.set(name, tool);
    return this;
  }

  registerAll(tools: Record<string, Tool>): this {
    for (const [name, tool] of Object.entries(tools)) {
      this.register(name, tool);
    }
    return this;
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  toAiTools(): Record<string, Tool> {
    return Object.fromEntries(this.tools);
  }
}
