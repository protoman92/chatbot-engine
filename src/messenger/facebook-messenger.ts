import {
  DEFAULT_COORDINATES,
  formatFacebookError,
  isType
} from '../common/utils';
import { Transformer } from '../type/common';
import { Facebook } from '../type/facebook';
import { Leaf } from '../type/leaf';
import { Messenger } from '../type/messenger';
import { VisualContent } from '../type/visual-content';
import { createMessenger } from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createFacebookRequest<C>(
  webhook: Facebook.PlatformRequest,
  senderPlatform: 'facebook'
): readonly Facebook.GenericRequest<C>[] {
  const { object, entry } = webhook;

  /** Group requests based on sender ID. */
  function groupRequests(reqs: readonly Facebook.PlatformRequest.Input[]) {
    const requestMap: {
      [K: string]: readonly Facebook.PlatformRequest.Input[];
    } = {};

    reqs.forEach(req => {
      const senderID = req.sender.id;
      requestMap[senderID] = (requestMap[senderID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(
    request: Facebook.PlatformRequest.Input,
    senderPlatform: 'facebook'
  ): Facebook.GenericRequest<C>['data'] {
    if (isType<Facebook.PlatformRequest.Input.Postback>(request, 'postback')) {
      return [
        {
          senderPlatform,
          inputText: request.postback.payload,
          inputImageURL: '',
          inputCoordinate: DEFAULT_COORDINATES,
          stickerID: ''
        }
      ];
    }

    if (isType<Facebook.PlatformRequest.Input.Message>(request, 'message')) {
      const { message } = request;

      if (
        isType<Facebook.PlatformRequest.Input.Message.QuickReply>(
          message,
          'quick_reply'
        )
      ) {
        return [
          {
            senderPlatform,
            inputText: message.quick_reply.payload,
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: ''
          }
        ];
      }

      if (
        isType<Facebook.PlatformRequest.Input.Message.Text['message']>(
          message,
          'text'
        )
      ) {
        return [
          {
            senderPlatform,
            inputText: message.text,
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: ''
          }
        ];
      }

      if (
        isType<Facebook.PlatformRequest.Input.Message.Attachment['message']>(
          message,
          'attachments'
        )
      ) {
        const { attachments } = message;

        return attachments.map(attachment => {
          switch (attachment.type) {
            case 'image':
              return {
                senderPlatform,
                inputText: attachment.payload.url,
                inputImageURL: attachment.payload.url,
                inputCoordinate: DEFAULT_COORDINATES,
                stickerID: (() => {
                  if (
                    isType<
                      Facebook.PlatformRequest.Input.Attachment.StickerImage
                    >(attachment.payload, 'sticker_id')
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
                senderPlatform,
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

        return Object.entries(groupedRequests).map(([senderID, requests]) => ({
          senderID,
          senderPlatform: 'facebook',
          oldContext: {} as any,
          data: requests
            .map(req => processRequest(req, senderPlatform))
            .reduce((acc, items) => acc.concat(items), [])
        }));
      }
  }

  throw new Error(
    formatFacebookError(`Invalid webhook: ${JSON.stringify(webhook)}`)
  );
}

/**
 * Create a Facebook response from multiple generic responses.
 * @template C The context used by the current chatbot.
 */
function createFacebookResponse<C>({
  senderID,
  visualContents
}: Facebook.GenericResponse<C>): readonly Facebook.PlatformResponse[] {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(
    action: VisualContent.SubContent.Action
  ): Facebook.PlatformResponse.SubContent.Button {
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
  }: VisualContent.MainContent.Button): Facebook.PlatformResponse.Content.Button {
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
  }: VisualContent.MainContent.Carousel): Facebook.PlatformResponse.Content.Carousel {
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
  ): Facebook.PlatformResponse.Content.List {
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
  }: VisualContent.MainContent.Media): Facebook.PlatformResponse.Content.Media {
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

  function createTextResponse({
    text
  }: VisualContent.MainContent.Text): Facebook.PlatformResponse.Content.Text {
    return { messaging_type: 'RESPONSE', message: { text } };
  }

  function createResponse(
    content: Facebook.GenericResponse<C>['visualContents'][number]['content']
  ): Facebook.PlatformResponse.Output {
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
        return createTextResponse(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply. */
  function createQuickReply(
    quickReply: Facebook.VisualContent.QuickReply
  ): Facebook.PlatformResponse.QuickReply {
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
    {
      content,
      quickReplies = []
    }: Facebook.GenericResponse<C>['visualContents'][number]
  ): Facebook.PlatformResponse {
    const fbQuickReplies = quickReplies.map(qr => createQuickReply(qr));
    const fbResponse = createResponse(content);
    const { message: baseMessage } = fbResponse;

    const message = {
      ...baseMessage,
      quick_replies: !!fbQuickReplies.length ? fbQuickReplies : undefined
    };

    return { ...fbResponse, message, recipient: { id: senderID } };
  }

  return visualContents.map(visualContent => {
    return createPlatformResponse(senderID, visualContent);
  });
}

/**
 * Create a Facebook messenger.
 * @template C The context used by the current chatbot.
 */
export async function createFacebookMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: Facebook.Communicator,
  ...transformers: readonly Transformer<
    Messenger<C, Facebook.PlatformRequest>
  >[]
): Promise<Facebook.Messenger<C>> {
  return createMessenger(
    'facebook',
    leafSelector,
    communicator,
    async req => {
      if (isType<Facebook.PlatformRequest>(req, 'object', 'entry')) {
        return createFacebookRequest(req, 'facebook');
      }

      throw new Error(
        formatFacebookError(`Invalid webhook ${JSON.stringify(req)}`)
      );
    },
    async res => createFacebookResponse(res as Facebook.GenericResponse<C>),
    ...transformers
  );
}
