import { ChatbotContext } from "..";
import { AmbiguousPlatform } from "./messenger";

/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 */
export interface ContextDAO {
  /** Get the whole context in storage */
  getContext(
    args: Readonly<{ targetID: string; targetPlatform: AmbiguousPlatform }>
  ): Promise<ChatbotContext>;

  /** Append to the current context in storage */
  appendContext(
    args: Readonly<{
      additionalContext: Partial<ChatbotContext>;
      /** If this is specified, we do not need to refetch it from database */
      oldContext?: ChatbotContext;
      targetID: string;
      targetPlatform: AmbiguousPlatform;
    }>
  ): Promise<
    Readonly<{ newContext: ChatbotContext; oldContext: ChatbotContext }>
  >;

  /** Reset all context to factory */
  resetContext(
    args: Readonly<{ targetID: string; targetPlatform: AmbiguousPlatform }>
  ): Promise<unknown>;
}
