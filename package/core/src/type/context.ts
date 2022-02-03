import { ChatbotContext } from "..";

export interface ContextChangeRequestInput {
  readonly changedContext: Partial<ChatbotContext>;
  readonly newContext: ChatbotContext;
  readonly oldContext: ChatbotContext;
  readonly type: "context_change";
}
