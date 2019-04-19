import { formatFacebookError, isType } from '../common/utils';
import { Context } from '../type/common';
import { HTTPCommunicator } from '../type/communicator';
import {
  FacebookConfigs,
  FacebookRequest,
  FacebookWebhookRequest
} from '../type/facebook';
import { GenericRequest, Messenger, UnitMessenger } from '../type/messenger';
import { createFacebookCommunicator } from './facebook-communicator';
import {
  createGenericMessenger,
  createGenericUnitMessenger
} from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The shape of the context used by the current chatbot.
 * @param webhook Facebook webhook data.
 * @return An Array of generic request.
 */
export function mapWebhook<C extends Context>(
  webhook: FacebookWebhookRequest
): GenericRequest<C>[] {
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

  function processRequest(request: FacebookRequest): GenericRequest<C>['data'] {
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
            oldContext: {} as any,
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
 * @template C The shape of the context used by the current chatbot.
 * @param httpCommunicator A HTTP communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export function createUnitFacebookMessenger<C extends Context>(
  httpCommunicator: HTTPCommunicator,
  configurations: FacebookConfigs
): UnitMessenger<C> {
  const comm = createFacebookCommunicator(httpCommunicator, configurations);
  return createGenericUnitMessenger(comm);
}

/**
 * Create a Facebook mesenger.
 * @template C The shape of the context used by the current chatbot.
 * @param unitMessenger A unit messenger.
 * @return A generic messenger.
 */
export function createFacebookMessenger<C extends Context>(
  unitMessenger: UnitMessenger<C>
): Messenger {
  return createGenericMessenger({
    unitMessenger,
    requestMapper: async req => {
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
