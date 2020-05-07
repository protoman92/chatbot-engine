import { AmbiguousPlatform } from "./messenger";

/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 */
export interface ContextDAO<Context> {
  /** Get the whole context in storage */
  getContext(targetID: string, platform: AmbiguousPlatform): Promise<Context>;

  /** Append to the current context in storage */
  appendContext(
    targetID: string,
    platform: AmbiguousPlatform,
    context: Partial<Context>
  ): Promise<Readonly<{ newContext: Context; oldContext: Context }>>;

  /** Reset all context to factory */
  resetContext(targetID: string, platform: AmbiguousPlatform): Promise<unknown>;
}
