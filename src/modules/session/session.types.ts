export type ConversationState =
  | 'IDLE'
  | 'AWAITING_MENU_SELECTION'
  | 'FLOW_ACTIVE'
  | 'CONDITIONAL_FLOW_ACTIVE'
  | 'ESCALATED';

export interface FlowData {
  [key: string]: string | Record<string, unknown>;
}

export interface ConversationSession {
  senderId: string;
  clientName: string;
  state: ConversationState;

  // ─── Legacy flow fields (guided/ai flows) ─────────────────────
  /** ID of the active legacy flow (matches a key in bot.config.json flows map) */
  activeFlowId: string | null;
  /** Current step index within a guided flow */
  flowStep: number;

  // ─── Conditional flow fields ──────────────────────────────────
  /** ID of the active conditional flow (matches a key in conditionalFlows map) */
  activeConditionalFlowId: string | null;
  /** ID of the current step within the conditional flow */
  activeStepId: string | null;
  /** Breadcrumb of step IDs visited — used for {flowPath} system variable */
  flowPath: string[];
  /** When the current conditional flow started */
  flowStartedAt: Date | null;

  // ─── Shared ───────────────────────────────────────────────────
  /** Data collected during a flow (strings or matched objects from validate steps) */
  flowData: FlowData;
  /** Conversation history for AI context */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivityAt: Date;
}
