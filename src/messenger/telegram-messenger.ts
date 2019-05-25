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
  const {
    message: {
      chat: { id }
    }
  } = webhook;

  function processRequest(
    request: Telegram.PlatformRequest,
    targetPlatform: 'telegram'
  ): Telegram.GenericRequest<C>['data'] {
    const { message } = request;

    if (isType<Telegram.PlatformRequest.Input.Text>(message, 'text')) {
      return [
        {
          targetPlatform,
          inputText: message.text,
          inputImageURL: '',
          inputCoordinate: DEFAULT_COORDINATES
        }
      ];
    }

    throw Error(
      formatTelegramError(`Invalid request ${JSON.stringify(request)}`)
    );
  }

  return [
    {
      targetPlatform,
      targetID: `${id}`,
      oldContext: {} as C,
      data: processRequest(webhook, targetPlatform)
    }
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

  /** Create a Telegram quick reply from a generic quick reply. */
  function createQuickReply(
    quickReply: VisualContent.QuickReply
  ): Telegram.PlatformResponse.Keyboard.Button {
    const { text } = quickReply;

    switch (quickReply.type) {
      case 'text':
        return {
          text,
          request_contact: undefined,
          request_location: undefined
        };

      case 'location':
        return { text, request_contact: undefined, request_location: true };
    }
  }

  function createPlatformResponse(
    targetID: string,
    {
      quickReplies,
      content
    }: Telegram.GenericResponse<C>['visualContents'][number]
  ): Telegram.PlatformResponse {
    const tlQuickReplies:
      | Telegram.PlatformResponse.Keyboard.ReplyMarkup
      | undefined = quickReplies && {
      keyboard: quickReplies.map(qrs => qrs.map(qr => createQuickReply(qr))),
      resize_keyboard: true,
      one_time_keyboard: true,
      selective: false
    };

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
    'telegram',
    leafSelector,
    communicator,
    async req => createTelegramRequest(req, 'telegram'),
    async res => createTelegramResponse(res as Telegram.GenericResponse<C>),
    ...transformers
  );
}
