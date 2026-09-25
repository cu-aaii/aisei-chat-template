// Friendly labels for tool-call names shown in the chat UI's tool-call summary while
// a tool is running. Keyed by the same names registered in chat.routes.ts's
// ToolRegistry — any tool without an entry here falls back to its raw name
// client-side (see ChatPanelComponent.toolLabel).
export const TOOL_LABELS: Record<string, string> = {
  search_content: 'Searching site content',
  read_content: 'Reading a page',
};
