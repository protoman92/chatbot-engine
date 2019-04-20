import { Context } from './common';

/**
 * Represents a DAO object that performs CRUD operations for a chatbot's
 * context. We can usually use Redis for this purpose, but there is no required
 * persistence framework here.
 * @template C The shape of the context used by the current chatbot.
 */
export interface ContextDAO<C extends Context> {
  /**
   * Get the whole context in storage.
   * @param cacheKey The key identifying the change.
   * @return A Promise of context.
   */
  getContext(cacheKey: string): Promise<C>;

  /**
   * Set the whole context in storage.
   * @param cacheKey The key identifying the cache.
   * @param context The context object being saved.
   * @return A Promise of some response.
   */
  setContext(cacheKey: string, context: C): Promise<unknown>;

  /**
   * Reset all context to factory.
   * @return A Promise of some response.
   */
  resetAll(): Promise<void>;
}
