/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 * @template C The context used by the current chatbot.
 */
export interface ContextDAO<C> {
  /**
   * Get the whole context in storage.
   * @param senderID The sender ID.
   * @return A Promise of context.
   */
  getContext(senderID: string): Promise<C>;

  /**
   * Set the whole context in storage.
   * @param senderID The sender ID.
   * @param context The context object being saved.
   * @return A Promise of some response.
   */
  setContext(senderID: string, context: C): Promise<unknown>;

  /**
   * Reset all context to factory.
   * @param senderID The sender ID.
   * @return A Promise of some response.
   */
  resetContext(senderID: string): Promise<unknown>;
}
