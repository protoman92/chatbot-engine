import { AmbiguousPlatform } from "./messenger";

/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 * @template C The context used by the current chatbot.
 */
export interface ContextDAO<C> {
  /** Get the whole context in storage. */
  getContext(targetID: string, platform: AmbiguousPlatform): Promise<C>;

  /** Append to the current context in storage. */
  appendContext(
    targetID: string,
    platform: AmbiguousPlatform,
    context: Partial<C>
  ): Promise<unknown>;

  /** Reset all context to factory. */
  resetContext(targetID: string, platform: AmbiguousPlatform): Promise<unknown>;
}
