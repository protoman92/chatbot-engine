/** Handle HTTP communication. */
export interface HTTPCommunicator {
  communicate<T>(
    params: Readonly<{
      url: string;
      method: 'GET' | 'POST';
      body?: unknown;
      headers: Readonly<{ [K: string]: unknown }>;
    }>
  ): PromiseLike<T>;
}
