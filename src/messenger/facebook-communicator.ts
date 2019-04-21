import { HTTPCommunicator, ServiceCommunicator } from '../type/communicator';
import { FacebookConfigs } from '../type/facebook';

/**
 * Create a service communicator for Facebook.
 * @param communicator A HTTP communicator instance.
 * @param configurations Config variables.
 * @return A service communicator instance.
 */
export function createFacebookCommunicator(
  communicator: HTTPCommunicator,
  { apiVersion, pageToken }: Pick<FacebookConfigs, 'apiVersion' | 'pageToken'>
): ServiceCommunicator {
  function formatURL(...additionalPaths: string[]) {
    return `https://graph.facebook.com/v${apiVersion}/${additionalPaths.join(
      '/'
    )}?access_token=${pageToken}`;
  }

  async function get<T>(...additionalPaths: string[]) {
    return communicator.communicate<T>({
      method: 'GET',
      url: formatURL(...additionalPaths)
    });
  }

  async function post<T>(body: unknown, ...additionalPaths: string[]) {
    return communicator.communicate<T>({
      body,
      method: 'POST',
      url: formatURL(...additionalPaths),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return {
    getUser: async <U>(senderID: string) => {
      const facebookUser = await get<U | undefined | null>(senderID);
      if (!facebookUser) throw Error(`Unable to find user for id ${senderID}`);
      return facebookUser;
    },

    sendResponse: data => {
      return post(data, 'me', 'messages');
    },

    setTypingIndicator: (senderID, enabled) => {
      return post(
        {
          recipient: { id: senderID },
          sender_action: enabled ? 'typing_on' : 'typing_off'
        },
        'me',
        'messages'
      );
    }
  };
}
