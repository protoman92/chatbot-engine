import { formatFacebookError, isType } from '../common/utils';
import { Context } from '../type/common';
import { HTTPCommunicator } from '../type/communicator';
import {
  FacebookConfigs,
  FacebookRequest,
  FacebookUnitMessenger,
  FacebookWebhookRequest
} from '../type/facebook';
import { LeafSelector } from '../type/leaf-selector';
import { Messenger, UnitMessenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse, PlatformResponse } from '../type/response';
import { Action, Response } from '../type/visual-content';
import { createFacebookCommunicator } from './facebook-communicator';
import {
  createGenericMessenger,
  createGenericUnitMessenger
} from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 * @param webhook Facebook webhook data.
 * @return An Array of generic request.
 */
export function mapWebhook<C extends Context>(
  webhook: FacebookWebhookRequest
): readonly GenericRequest<C>[] {
  const { object, entry } = webhook;

  /**
   * Group requests based on sender ID.
   * @param reqs A request Array.
   * @return A map of requests.
   */
  function groupRequests(reqs: readonly FacebookRequest[]) {
    const requestMap: { [K: string]: FacebookRequest[] } = {};

    reqs.forEach(req => {
      const senderID = req.sender.id;
      requestMap[senderID] = (requestMap[senderID] || []).concat([req]);
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
 * Create a Facebook response from multiple generic responses.
 * @template C The context used by the current chatbot.
 * @param response A generic responses.
 * @return A platform response instance.
 */
async function createFacebookResponse<C extends Context>({
  senderID,
  visualContents: contents
}: GenericResponse<C>): Promise<readonly PlatformResponse[]> {
  const MAX_GENERIC_ELEMENT_COUNT = 11;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(action: Action) {
    const { text: title, type } = action;
    const buttonPayload = { title, type };

    if (isType<Action.Postback>(action, 'payload')) {
      const { payload } = action;
      return { ...buttonPayload, payload };
    }

    throw Error(
      formatFacebookError(`Unrecognized action ${JSON.stringify(action)}`)
    );
  }

  function createCarouselResponse({ items }: Response.Carousel) {
    if (!items.length) {
      throw Error(formatFacebookError('Not enough carousel items'));
    }

    return {
      attachment: {
        type: 'template',
        payload: {
          elements: items
            .slice(0, MAX_GENERIC_ELEMENT_COUNT)
            .map(
              ({
                title = '',
                description: subtitle,
                // tslint:disable-next-line:variable-name
                media_url: image_url,
                actions: buttons = []
              }) => ({
                title,
                subtitle,
                image_url,
                buttons: buttons.length
                  ? buttons.map(action => createSingleAction(action))
                  : undefined
              })
            ),
          template_type: 'generic'
        }
      }
    };
  }

  function createListResponse(response: Response.List) {
    const { items, actions: listButtons = [] } = response;

    /**
     * If there is only 1 element, Facebook throws an error, so we switch back
     * to carousel if possible.
     */
    if (items.length <= 1) {
      return createCarouselResponse({ ...response, type: 'carousel' });
    }

    return {
      attachment: {
        type: 'template',
        payload: {
          elements: items
            .slice(0, MAX_LIST_ELEMENT_COUNT)
            .map(
              ({
                title = '',
                description: subtitle,
                actions: itemButtons = []
              }) => ({
                title,
                subtitle,
                buttons: itemButtons.length
                  ? itemButtons.map(action => createSingleAction(action))
                  : undefined
              })
            ),
          template_type: 'list',
          top_element_style: 'compact',
          buttons: listButtons.length ? listButtons : undefined
        }
      }
    };
  }

  function createResponse(response: Response) {
    if (isType<Response.Text>(response, 'text')) {
      return { text: response.text };
    }

    if (
      isType<Response.Carousel>(response, 'items', 'type') &&
      response.type === 'carousel'
    ) {
      return createCarouselResponse(response);
    }

    if (
      isType<Response.List>(response, 'items', 'type') &&
      response.type === 'list'
    ) {
      return createListResponse(response);
    }

    throw Error(`FB: Unable to parse response ${JSON.stringify(response)}`);
  }

  function createPlatformResponse(
    senderID: string,
    { response, quickReplies = [] }: GenericResponse<C>['visualContents'][0]
  ) {
    const facebookQuickReplies = quickReplies.map(({ text: title }) => ({
      title,
      content_type: 'text',
      payload: title
    }));

    return {
      messaging_type: 'RESPONSE',
      recipient: { id: senderID },
      message: {
        ...createResponse(response),
        quick_replies: facebookQuickReplies.length
          ? facebookQuickReplies
          : undefined
      }
    };
  }

  return contents.map(content => createPlatformResponse(senderID, content));
}

/**
 * Create a unit Facebook messenger.
 * @template C The context used by the current chatbot.
 * @param httpCommunicator A HTTP communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export async function createFacebookUnitMessenger<C extends Context>(
  leafSelector: LeafSelector<C>,
  httpCommunicator: HTTPCommunicator,
  configurations: FacebookConfigs
): Promise<FacebookUnitMessenger<C>> {
  const comm = createFacebookCommunicator(httpCommunicator, configurations);

  const unitMessenger = await createGenericUnitMessenger(
    leafSelector,
    comm,
    response => createFacebookResponse(response)
  );

  return {
    ...unitMessenger,
    resolveVerifyChallenge: async ({
      'hub.mode': mode = '',
      'hub.challenge': challenge = -1,
      'hub.verify_token': token = ''
    }) => {
      const { verifyToken } = configurations;
      if (mode === 'subscribe' && token === verifyToken) return challenge;
      throw new Error(formatFacebookError('Invalid mode or verify token'));
    }
  };
}

/**
 * Create a Facebook mesenger.
 * @template C The context used by the current chatbot.
 * @param unitMessenger A unit messenger.
 * @return A generic messenger.
 */
export function createFacebookMessenger<C extends Context>(
  unitMessenger: UnitMessenger<C>
): Messenger {
  return createGenericMessenger(unitMessenger, async req => {
    if (isType<FacebookWebhookRequest>(req, 'object', 'entry')) {
      return mapWebhook(req);
    }

    const errorMessage = `Invalid webhook: ${JSON.stringify(req)}`;
    throw new Error(formatFacebookError(errorMessage));
  });
}
