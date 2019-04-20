/** Handle HTTP communication. */
export interface HTTPCommunicator {
  communicate<T>(
    params: Readonly<{
      url: string;
      method: 'GET' | 'POST';
      body?: unknown;
      headers: Readonly<{ [K: string]: unknown }>;
    }>
  ): Promise<T>;
}

/**
 * Represents an object that handles the communicator to/from the relevant
 * service. For example, a Facebook service communicator should be able to
 * handle all methods specified here.
 */
export interface ServiceCommunicator {
  /**
   * Get the user associated with a sender ID.
   * @param senderID A string value.
   * @return A Promise of an user object.
   */
  getUser<U>(senderID: string): Promise<U>;

  /**
   * Send a response to the related service.
   * @param data Response payload.
   * @returns A Promise of some response.
   */
  sendResponse(data: unknown): Promise<unknown>;

  /**
   * Toggle typing indicator.
   * @param senderID A string value.
   * @param enabled A boolean value.
   * @return A Promise of some response.
   */
  setTypingIndicator(senderID: string, enabled: boolean): Promise<unknown>;
}
