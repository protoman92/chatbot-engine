import { HTTPCommunicator } from './http-communicator';
import { ServiceCommunicator } from './service-communicator';

/**
 * Create a service communicator for Facebook.
 * @param communicator A HTTP communicator instance.
 * @param configVars Config variables.
 * @return A service communicator instance.
 */
export function createFacebookCommunicator(
  communicator: HTTPCommunicator,
  configVars: Readonly<{ facebookPageToken: string }>
): ServiceCommunicator {
  async function communicate<T>({
    method,
    additionalPaths = [],
    body
  }: Readonly<{
    method: 'GET' | 'POST';
    additionalPaths?: string[];
    body?: unknown;
  }>): Promise<T> {
    return communicator.communicate<T>({
      method,
      body,
      url: `https://graph.facebook.com/v2.6/${additionalPaths.join(
        '/'
      )}?access_token=${configVars.facebookPageToken}`,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return {
    getUser: async <U>(senderID: string) => {
      const facebookUser = await communicate<U | undefined | null>({
        method: 'GET',
        additionalPaths: [senderID]
      });

      if (!facebookUser) throw Error(`Unable to find user for id ${senderID}`);
      return facebookUser;
    },

    sendResponse: data => {
      return communicate({
        method: 'POST',
        additionalPaths: ['me', 'messages'],
        body: data
      });
    },

    setTypingIndicator: (senderID, enabled) => {
      return communicate({
        method: 'POST',
        additionalPaths: ['me', 'messages'],
        body: {
          recipient: { id: senderID },
          sender_action: enabled ? 'typing_on' : 'typing_off'
        }
      });
    }
  };
}
