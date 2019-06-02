import { Omit } from 'ts-essentials';
import {
  DEFAULT_COORDINATES,
  formatTelegramError,
  isType
} from '../common/utils';
import { Transformer } from '../type/common';
import { Leaf } from '../type/leaf';
import { Messenger } from '../type/messenger';
import { Telegram } from '../type/telegram';
import { VisualContent } from '../type/visual-content';
import { createMessenger } from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createTelegramRequest<C>(
  webhook: Telegram.PlatformRequest,
  targetPlatform: 'telegram'
): readonly Telegram.GenericRequest<C>[] {
  function processMessageRequest({
    message: {
      from: { id },
      ...restMessage
    }
  }: Telegram.PlatformRequest.Message):
    | [number, Telegram.GenericRequest<C>['data']]
    | undefined {
    if (
      isType<Telegram.PlatformRequest.SubContent.Message.Text>(
        restMessage,
        'text'
      )
    ) {
      return [
        id,
        [
          {
            targetPlatform,
            inputText: restMessage.text,
            inputImageURL: '',
            inputCoordinate: DEFAULT_COORDINATES
          }
        ]
      ];
    }

    return undefined;
  }

  function processCallbackRequest({
    callback_query: {
      data,
      from: { id }
    }
  }: Telegram.PlatformRequest.Callback):
    | [number, Telegram.GenericRequest<C>['data']]
    | undefined {
    return [
      id,
      [
        {
          targetPlatform,
          inputText: data,
          inputImageURL: '',
          inputCoordinate: DEFAULT_COORDINATES
        }
      ]
    ];
  }

  function processRequest(
    request: Telegram.PlatformRequest,
    targetPlatform: 'telegram'
  ): [number, Telegram.GenericRequest<C>['data']] {
    let result: [number, Telegram.GenericRequest<C>['data']] | undefined;

    if (isType<Telegram.PlatformRequest.Message>(request, 'message')) {
      result = processMessageRequest(request);
    }

    if (isType<Telegram.PlatformRequest.Callback>(request, 'callback_query')) {
      result = processCallbackRequest(request);
    }

    if (!!result) return result;

    throw Error(
      formatTelegramError(`Invalid request ${JSON.stringify(request)}`)
    );
  }

  const [targetID, data] = processRequest(webhook, targetPlatform);

  return [
    { targetPlatform, data, targetID: `${targetID}`, oldContext: {} as C }
  ];
}

/**
 * Create a Telegram response from multiple generic responses.
 * @template C The context used by the current chatbot.
 */
function createTelegramResponse<C>({
  targetID,
  visualContents
}: Telegram.GenericResponse<C>): readonly Telegram.PlatformResponse[] {
  function createTextResponse(
    targetID: string,
    { text }: VisualContent.MainContent.Text
  ): Omit<Telegram.PlatformResponse.SendMessage, 'reply_markup'> {
    return { text, action: 'sendMessage', chat_id: targetID };
  }

  /** Only certain quick reply types supports inline markups. */
  function createInlineMarkups(
    quickReplies: Telegram.VisualContent.QuickReply.InlineMarkups
  ): Telegram.PlatformResponse.InlineKeyboardMarkup {
    return {
      inline_keyboard: quickReplies.map(qrs =>
        qrs.map(qr => {
          const { text } = qr;

          switch (qr.type) {
            case 'postback':
              return { text, callback_data: qr.payload };

            case 'text':
              return { text, callback_data: text };
          }
        })
      )
    };
  }

  /** Only certain quick reply types support reply markups. */
  function createReplyMarkups(
    quickReplies: Telegram.VisualContent.QuickReply.ReplyMarkups
  ): Telegram.PlatformResponse.ReplyKeyboardMarkup {
    return {
      keyboard: quickReplies.map(qrs =>
        qrs.map(qr => {
          const { text } = qr;

          switch (qr.type) {
            case 'location':
              return {
                text,
                request_contact: undefined,
                request_location: true
              };

            case 'contact':
              return {
                text,
                request_contact: true,
                request_location: undefined
              };

            case 'text':
              return {
                text,
                request_contact: undefined,
                request_location: undefined
              };
          }
        })
      ),
      resize_keyboard: true,
      one_time_keyboard: true,
      selective: false
    };
  }

  /** Create a Telegram quick reply from a generic quick reply. */
  function createQuickReplies(
    quickReplies: Telegram.VisualContent.QuickReplies
  ): Telegram.PlatformResponse.ReplyMarkup {
    const shouldBeReplyMarkup = quickReplies.every(
      (qrs: Telegram.VisualContent.QuickReplies[number]) =>
        qrs.every(
          ({ type }: Telegram.VisualContent.QuickReplies[number][number]) => {
            return type === 'location';
          }
        )
    );

    if (shouldBeReplyMarkup) {
      return createReplyMarkups(
        quickReplies as Telegram.VisualContent.QuickReply.ReplyMarkups
      );
    }

    return createInlineMarkups(
      quickReplies as Telegram.VisualContent.QuickReply.InlineMarkups
    );
  }

  function createPlatformResponse(
    targetID: string,
    {
      quickReplies,
      content
    }: Telegram.GenericResponse<C>['visualContents'][number]
  ): Telegram.PlatformResponse {
    const tlQuickReplies = quickReplies && createQuickReplies(quickReplies);

    switch (content.type) {
      case 'text':
        return {
          ...createTextResponse(targetID, content),
          reply_markup: tlQuickReplies
        };

      default:
        throw new Error(
          formatTelegramError(`Unsupported content ${JSON.stringify(content)}`)
        );
    }
  }

  return visualContents.map(visualContent => {
    return createPlatformResponse(targetID, visualContent);
  });
}

/**
 * Create a Telegram messenger.
 * @template C The context used by the current chatbot.
 */
export async function createTelegramMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: Telegram.Communicator,
  ...transformers: readonly Transformer<
    Messenger<C, Telegram.PlatformRequest>
  >[]
): Promise<Telegram.Messenger<C>> {
  await communicator.setWebhook();

  return createMessenger(
    {
      leafSelector,
      communicator,
      targetPlatform: 'telegram',
      mapRequest: async req => createTelegramRequest(req, 'telegram'),
      mapResponse: async res => {
        return createTelegramResponse(res as Telegram.GenericResponse<C>);
      }
    },
    ...transformers
  );
}
