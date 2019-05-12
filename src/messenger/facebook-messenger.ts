import { formatFacebookError, isType } from '../common/utils';
import { Transformer } from '../type/common';
import { PlatformCommunicator } from '../type/communicator';
import { ContextDAO } from '../type/context-dao';
import {
  FacebookConfigs,
  FacebookRequest as FBR,
  FacebookUnitMessenger,
  FacebookWebhookRequest
} from '../type/facebook';
import { Leaf } from '../type/leaf';
import { Messenger, UnitMessenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse, PlatformResponse } from '../type/response';
import { Action, QuickReply, Response } from '../type/visual-content';
import {
  createGenericMessenger,
  createGenericUnitMessenger
} from './generic-messenger';
import {
  injectContextOnReceive,
  saveContextOnSend,
  setTypingIndicator
} from './unit-transform';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 * @param webhook Facebook webhook data.
 * @return An Array of generic request.
 */
export function mapWebhook<C>(
  webhook: FacebookWebhookRequest
): readonly GenericRequest<C>[] {
  const { object, entry } = webhook;

  /**
   * Group requests based on sender ID.
   * @param reqs A request Array.
   * @return A map of requests.
   */
  function groupRequests(reqs: readonly FBR[]) {
    const requestMap: { [K: string]: FBR[] } = {};

    reqs.forEach(req => {
      const senderID = req.sender.id;
      requestMap[senderID] = (requestMap[senderID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(request: FBR): GenericRequest<C>['data'] {
    if (isType<FBR.Postback>(request, 'postback')) {
      return [
        {
          inputText: request.postback.payload,
          inputImageURL: undefined,
          inputCoordinate: undefined
        }
      ];
    }

    if (isType<FBR.Message>(request, 'message')) {
      const { message } = request;

      if (isType<FBR.Message.QuickReply>(message, 'quick_reply')) {
        return [
          {
            inputText: message.quick_reply.payload,
            inputImageURL: undefined,
            inputCoordinate: undefined
          }
        ];
      }

      if (isType<FBR.Message.Text['message']>(message, 'text')) {
        return [
          {
            inputText: message.text,
            inputImageURL: undefined,
            inputCoordinate: undefined
          }
        ];
      }

      if (isType<FBR.Message.Attachment['message']>(message, 'attachments')) {
        const { attachments } = message;

        return attachments.map(attachment => {
          switch (attachment.type) {
            case 'image':
              return {
                inputText: attachment.payload.url,
                inputImageURL: attachment.payload.url,
                inputCoordinate: undefined
              };

            case 'location':
              const { lat, long } = attachment.payload.coordinates;
              const coordinates = { lat, lng: long };

              return {
                inputText: JSON.stringify(coordinates),
                inputImageURL: undefined,
                inputCoordinate: coordinates
              };
          }
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
          ([senderID, requests]: [string, FBR[]]) => ({
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
async function createFacebookResponse<C>({
  senderID,
  visualContents: contents
}: GenericResponse<C>): Promise<readonly PlatformResponse[]> {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(action: Action) {
    const { text: title } = action;

    switch (action.type) {
      case 'postback':
        return { title, type: 'postback', payload: action.payload };

      case 'url':
        return { title, type: 'web_url', url: action.url };
    }
  }

  function createButtonResponse(buttonResponse: Response.Button) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: buttonResponse.text,
          buttons: buttonResponse.actions.map(a => createSingleAction(a))
        }
      }
    };
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
                mediaURL: image_url,
                actions: buttons
              }) => ({
                title,
                subtitle,
                image_url,
                buttons:
                  !!buttons && buttons.length
                    ? buttons.map(a => createSingleAction(a))
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
      return createCarouselResponse({
        ...response,
        items: items.map(item => ({ ...item, mediaURL: null })),
        type: 'carousel'
      });
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
                buttons:
                  !!itemButtons && itemButtons.length
                    ? itemButtons.map(a => createSingleAction(a))
                    : undefined
              })
            ),
          template_type: 'list',
          top_element_style: 'compact',
          buttons: !!listButtons && listButtons.length ? listButtons : undefined
        }
      }
    };
  }

  function createResponse(response: Response) {
    switch (response.type) {
      case 'button':
        return createButtonResponse(response);

      case 'carousel':
        return createCarouselResponse(response);

      case 'list':
        return createListResponse(response);

      case 'text':
      default:
        return { text: response.text };
    }
  }

  /**
   * Create a Facebook quick reply from a generic quick reply.
   * @param quickReply The generic quick reply.
   * @return A Facebook quick reply.
   */
  function createQuickReply(quickReply: QuickReply) {
    const { text } = quickReply;

    switch (quickReply.type) {
      case 'location':
        return {
          title: text,
          content_type: 'location',
          payload: text
        };

      case 'postback':
        return {
          title: text,
          content_type: 'text',
          payload: quickReply.payload
        };

      case 'text':
      default:
        return {
          title: text,
          content_type: 'text',
          payload: text
        };
    }
  }

  function createPlatformResponse(
    senderID: string,
    { response, quickReplies = [] }: GenericResponse<C>['visualContents'][0]
  ) {
    const facebookQuickReplies = quickReplies.map(createQuickReply);

    return {
      messaging_type: 'RESPONSE',
      recipient: { id: senderID },
      message: {
        ...createResponse(response),
        quick_replies: !!facebookQuickReplies.length
          ? facebookQuickReplies
          : undefined
      }
    };
  }

  return contents.map(content => createPlatformResponse(senderID, content));
}

/**
 * Create a unit Facebook messenger that does not have any default transformers.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export async function createBaseFacebookUnitMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: PlatformCommunicator,
  configurations: FacebookConfigs,
  ...transformers: readonly Transformer<UnitMessenger<C>>[]
): Promise<FacebookUnitMessenger<C>> {
  const unitMessenger = await createGenericUnitMessenger(
    leafSelector,
    communicator,
    response => createFacebookResponse(response),
    ...transformers
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
 * Force some default transform functions on the base unit messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param contextDAO A context DAO instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export function createFacebookUnitMessenger<C>(
  leafSelector: Leaf<C>,
  contextDAO: ContextDAO<C>,
  communicator: PlatformCommunicator,
  configuration: FacebookConfigs,
  ...transformers: Transformer<UnitMessenger<C>>[]
) {
  return createBaseFacebookUnitMessenger(
    leafSelector,
    communicator,
    configuration,
    injectContextOnReceive(contextDAO),
    saveContextOnSend(contextDAO),
    setTypingIndicator(communicator),
    ...transformers
  );
}

/**
 * Create a Facebook mesenger.
 * @template C The context used by the current chatbot.
 * @param unitMessenger A unit messenger.
 * @return A generic messenger.
 */
export function createFacebookMessenger<C>(
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
