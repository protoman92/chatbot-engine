import { createFacebookCommunicator } from './facebook-communicator';
import {
  FacebookConfigurations,
  FacebookRequest,
  FacebookWebhookRequest
} from './facebook-type';
import {
  createGenericMessenger,
  createGenericUnitMessenger
} from './generic-messenger';
import { HTTPCommunicator } from './http-communicator';
import {
  GenericMessenger,
  GenericRequest,
  GenericUnitMessenger
} from './generic-type';
import { formatFacebookError, isType } from '../common/utils';

/**
 * Map platform request to generic request for generic processing.
 * @param webhook Facebook webhook data.
 * @return An Array of generic request.
 */
export async function mapWebhook(webhook: FacebookWebhookRequest) {
  const { object, entry } = webhook;

  /**
   * Group requests based on sender ID.
   * @param reqs A request Array.
   * @return A map of requests.
   */
  function groupRequests(reqs: FacebookRequest[]) {
    const requestMap: { [K: string]: FacebookRequest[] } = {};

    reqs.forEach(args => {
      const senderID = args.sender.id;
      requestMap[senderID] = (requestMap[senderID] || []).concat([args]);
    });

    return requestMap;
  }

  function processRequest(request: FacebookRequest): GenericRequest['data'] {
    if (isType<FacebookRequest.Postback>(request, 'postback')) {
      return [{ text: request.postback.payload }];
    }

    if (isType<FacebookRequest.Message>(request, 'message')) {
      const { message } = request;

      if (isType<FacebookRequest.Message.Text['message']>(message, 'text')) {
        return [{ text: message.text }];
      }

      if (isType<FacebookRequest.Message.Attachment>(message, 'attachments')) {
        const { attachments } = message;

        return attachments.map(({ type, payload }) => {
          if (
            type === 'image' &&
            isType<
              FacebookRequest.Message.Attachment.Image['attachments'][0]['payload']
            >(payload, 'url')
          ) {
            return { image_url: payload.url, text: payload.url };
          }

          throw Error(
            formatFacebookError(`Invalid payload: ${JSON.stringify(payload)}`)
          );
        });
      }
    }

    throw Error(
      formatFacebookError(`Invalid request ${JSON.stringify(request)}`)
    );
  }

  switch (object) {
    case 'page':
      if (entry !== undefined && entry !== null) {
        const allRequests = entry
          .map(({ messaging }) => messaging)
          .filter(messaging => !!messaging)
          .reduce((acc, requests) => acc.concat(requests));

        const groupedRequests = groupRequests(allRequests);

        return Object.entries(groupedRequests).map(
          ([senderID, requests]: [string, FacebookRequest[]]) => ({
            senderID,
            oldContext: {},
            data: requests
              .map(req => processRequest(req))
              .reduce((acc, items) => acc.concat(items), [])
          })
        );
      }

      break;

    default:
      break;
  }

  throw new Error(
    formatFacebookError(`Invalid webhook: ${JSON.stringify(webhook)}`)
  );
}

/**
 * Create a unit Facebook messenger.
 * @param httpCommunicator A HTTP communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export function createUnitFacebookMessenger(
  httpCommunicator: HTTPCommunicator,
  configurations: FacebookConfigurations
): GenericUnitMessenger {
  const comm = createFacebookCommunicator(httpCommunicator, configurations);
  return createGenericUnitMessenger(comm);
}

/**
 * Create a Facebook mesenger.
 * @param unitMessenger A unit messenger.
 * @return A generic messenger.
 */
export function createFacebookMessenger(
  unitMessenger: GenericUnitMessenger
): GenericMessenger {
  return createGenericMessenger({
    unitMessenger,
    requestMapper: req => {
      if (isType<FacebookWebhookRequest>(req, 'object', 'entry')) {
        return mapWebhook(req);
      }

      throw new Error(
        formatFacebookError(`Invalid webhook: ${JSON.stringify(req)}`)
      );
    },
    responseMapper: async ({ senderID, newContext, data }) => ({
      senderID,
      newContext,
      data
    })
  });
}
