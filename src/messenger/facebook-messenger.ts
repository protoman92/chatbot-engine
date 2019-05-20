import {
  DEFAULT_COORDINATES,
  formatFacebookError,
  isType
} from '../common/utils';
import { Transformer } from '../type/common';
import { HTTPCommunicator } from '../type/communicator';
import {
  FacebookCommunicator,
  FacebookConfigs,
  FacebookRequest,
  FacebookResponse,
  FacebookUnitMessenger
} from '../type/facebook';
import { Leaf } from '../type/leaf';
import { Messenger, UnitMessenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse } from '../type/response';
import { VisualContent } from '../type/visual-content';
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
export function mapWebhook<C>(
  webhook: FacebookRequest
): readonly GenericRequest<C>[] {
  const { object, entry } = webhook;

  /**
   * Group requests based on sender ID.
   * @param reqs A request Array.
   * @return A map of requests.
   */
  function groupRequests(reqs: readonly FacebookRequest.Input[]) {
    const requestMap: {
      [K: string]: readonly FacebookRequest.Input[];
    } = {};

    reqs.forEach(req => {
      const senderID = req.sender.id;
      requestMap[senderID] = (requestMap[senderID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(
    request: FacebookRequest.Input
  ): GenericRequest<C>['data'] {
    if (isType<FacebookRequest.Input.Postback>(request, 'postback')) {
      return [
        {
          inputText: request.postback.payload,
          inputImageURL: '',
          inputCoordinate: DEFAULT_COORDINATES,
          stickerID: ''
        }
      ];
    }

    if (isType<FacebookRequest.Input.Message>(request, 'message')) {
      const { message } = request;

      if (
        isType<FacebookRequest.Input.Message.QuickReply>(message, 'quick_reply')
      ) {
        return [
          {
            inputText: message.quick_reply.payload,
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: ''
          }
        ];
      }

      if (
        isType<FacebookRequest.Input.Message.Text['message']>(message, 'text')
      ) {
        return [
          {
            inputText: message.text,
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: ''
          }
        ];
      }

      if (
        isType<FacebookRequest.Input.Message.Attachment['message']>(
          message,
          'attachments'
        )
      ) {
        const { attachments } = message;

        return attachments.map(attachment => {
          switch (attachment.type) {
            case 'image':
              return {
                inputText: attachment.payload.url,
                inputImageURL: attachment.payload.url,
                inputCoordinate: DEFAULT_COORDINATES,
                stickerID: (() => {
                  if (
                    isType<FacebookRequest.Input.Attachment.StickerImage>(
                      attachment.payload,
                      'sticker_id'
                    )
                  ) {
                    return `${attachment.payload.sticker_id}`;
                  }

                  return '';
                })()
              };

            case 'location':
              const { lat, long } = attachment.payload.coordinates;
              const coordinates = { lat, lng: long };

              return {
                inputText: JSON.stringify(coordinates),
                inputImageURL: '',
                inputCoordinate: coordinates,
                stickerID: ''
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
          ([senderID, requests]: [
            string,
            readonly FacebookRequest.Input[]
          ]) => ({
            senderID,
            senderPlatform: 'facebook' as const,
            oldContext: {} as any,
            data: requests
              .map(req => processRequest(req))
              .reduce((acc, items) => acc.concat(items), [])
          })
        );
      }
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
}: GenericResponse<C>): Promise<readonly FacebookResponse[]> {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(
    action: VisualContent.SubContent.Action
  ): FacebookResponse.SubContent.Button {
    const { text: title } = action;

    switch (action.type) {
      case 'postback':
        return { title, type: 'postback', payload: action.payload };

      case 'url':
        return { title, type: 'web_url', url: action.url };
    }
  }

  function createButtonResponse({
    text,
    actions
  }: VisualContent.MainContent.Button): FacebookResponse.Content.Button {
    return {
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'template',
          payload: {
            text,
            template_type: 'button',
            buttons: actions.map(a => createSingleAction(a))
          }
        }
      }
    };
  }

  function createCarouselResponse({
    items
  }: VisualContent.MainContent.Carousel): FacebookResponse.Content.Carousel {
    if (!items.length) {
      throw Error(formatFacebookError('Not enough carousel items'));
    }

    return {
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'template',
          payload: {
            elements: items
              .slice(0, MAX_GENERIC_ELEMENT_COUNT)
              .map(
                ({
                  title = '',
                  description,
                  // tslint:disable-next-line:variable-name
                  mediaURL,
                  actions: buttons
                }) => ({
                  title,
                  subtitle: description || undefined,
                  image_url: mediaURL || undefined,
                  buttons:
                    !!buttons && buttons.length
                      ? buttons.map(a => createSingleAction(a))
                      : undefined
                })
              ),
            template_type: 'generic'
          }
        }
      }
    };
  }

  function createListResponse(
    content: VisualContent.MainContent.List
  ): FacebookResponse.Content.List {
    const { items, actions: listActions } = content;

    /**
     * If there is only 1 element, Facebook throws an error, so we switch back
     * to carousel if possible.
     */
    if (items.length <= 1) {
      return createCarouselResponse({
        ...content,
        items: items.map(item => ({ ...item, mediaURL: undefined })),
        type: 'carousel'
      }) as any;
    }

    return {
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'template',
          payload: {
            elements: items
              .slice(0, MAX_LIST_ELEMENT_COUNT)
              .map(
                ({ title = '', description, actions: itemButtons = [] }) => ({
                  title,
                  subtitle: description || undefined,
                  buttons:
                    !!itemButtons && itemButtons.length
                      ? itemButtons.map(a => createSingleAction(a))
                      : undefined
                })
              ),
            template_type: 'list',
            top_element_style: 'compact',
            buttons:
              !!listActions && listActions.length
                ? listActions.map(a => createSingleAction(a))
                : undefined
          }
        }
      }
    };
  }

  function createMediaResponse({
    media: { type, url }
  }: VisualContent.MainContent.Media): FacebookResponse.Content.Media {
    return {
      message: {
        attachment: {
          type: (() => {
            switch (type) {
              case 'image':
                return 'image';

              case 'video':
                return 'video';
            }
          })(),
          payload: { url, is_reusable: true }
        }
      }
    };
  }

  function createResponse(
    content: VisualContent.MainContent
  ): FacebookResponse.Output {
    switch (content.type) {
      case 'button':
        return createButtonResponse(content);

      case 'carousel':
        return createCarouselResponse(content);

      case 'list':
        return createListResponse(content);

      case 'media':
        return createMediaResponse(content);

      case 'text':
        return {
          messaging_type: 'RESPONSE',
          message: { text: content.text }
        };
    }
  }

  /**
   * Create a Facebook quick reply from a generic quick reply.
   * @param quickReply The generic quick reply.
   * @return A Facebook quick reply.
   */
  function createQuickReply(
    quickReply: VisualContent.QuickReply
  ): FacebookResponse.QuickReply {
    const { text } = quickReply;

    switch (quickReply.type) {
      case 'location':
        return { title: text, content_type: 'location', payload: text };

      case 'postback':
        return {
          title: text,
          content_type: 'text',
          payload: quickReply.payload
        };

      case 'text':
        return { title: text, content_type: 'text', payload: text };
    }
  }

  function createPlatformResponse(
    senderID: string,
    { content, quickReplies = [] }: GenericResponse<C>['visualContents'][0]
  ): FacebookResponse {
    const fbQuickReplies = quickReplies.map(qr => createQuickReply(qr));
    const fbResponse = createResponse(content);
    const { message: baseMessage } = fbResponse;

    const message = {
      ...baseMessage,
      quick_replies: !!fbQuickReplies.length ? fbQuickReplies : undefined
    };

    return { ...fbResponse, message, recipient: { id: senderID } };
  }

  return contents.map(content => createPlatformResponse(senderID, content));
}

/**
 * Create a unit Facebook messenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A platform communicator instance.
 * @param configurations Facebook configurations.
 * @return A generic unit messenger.
 */
export async function createFacebookUnitMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: FacebookCommunicator,
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
 * Create a Facebook mesenger.
 * @template C The context used by the current chatbot.
 * @param leafSelector A leaf selector instance.
 * @param communicator A HTTP communicator instance.
 * @param configs Facebook configurations.
 * @return A generic messenger.
 */
export async function createFacebookMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: HTTPCommunicator,
  configs: FacebookConfigs,
  ...transformers: readonly Transformer<UnitMessenger<C>>[]
): Promise<Messenger<FacebookRequest, FacebookResponse>> {
  const fbCommunicator = createFacebookCommunicator(communicator, configs);

  const unitMessenger = await createFacebookUnitMessenger(
    leafSelector,
    fbCommunicator,
    configs,
    ...transformers
  );

  return createGenericMessenger(unitMessenger, async req => {
    if (isType<FacebookRequest>(req, 'object', 'entry')) {
      return mapWebhook(req);
    }

    const errorMessage = `Invalid webhook: ${JSON.stringify(req)}`;
    throw new Error(formatFacebookError(errorMessage));
  });
}
