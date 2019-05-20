/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 * @template C The context used by the current chatbot.
 */
export interface ContextDAO<C> {
  /** Get the whole context in storage. */
  getContext(senderID: string): Promise<C>;

  /** Set the whole context in storage. */
  setContext(senderID: string, context: C): Promise<unknown>;

  /** Reset all context to factory. */
  resetContext(senderID: string): Promise<unknown>;
}
