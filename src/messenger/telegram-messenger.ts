import {
  DEFAULT_COORDINATES,
  formatTelegramError,
  isType
} from '../common/utils';
import { Transformer } from '../type/common';
import { Leaf } from '../type/leaf';
import { Messenger } from '../type/messenger';
import { GenericRequest } from '../type/request';
import { GenericResponse } from '../type/response';
import {
  TelegramCommunicator,
  TelegramMessenger,
  TelegramRequest,
  TelegramResponse
} from '../type/telegram';
import { VisualContent } from '../type/visual-content';
import { createMessenger } from './generic-messenger';

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createTelegramRequest<C>(
  webhook: TelegramRequest,
  senderPlatform: 'telegram'
): readonly GenericRequest<C>[] {
  const {
    message: {
      chat: { id }
    }
  } = webhook;

  function processRequest(
    request: TelegramRequest,
    senderPlatform: 'telegram'
  ): GenericRequest.Telegram<C>['data'] {
    const { message } = request;

    if (isType<TelegramRequest.Input.Text>(message, 'text')) {
      return [
        {
          senderPlatform,
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
      senderPlatform,
      senderID: `${id}`,
      oldContext: {} as C,
      data: processRequest(webhook, senderPlatform)
    }
  ];
}

/**
 * Create a Telegram response from multiple generic responses.
 * @template C The context used by the current chatbot.
 */
function createTelegramResponse<C>({
  senderID,
  visualContents
}: GenericResponse.Telegram<C>): readonly TelegramResponse[] {
  function createTextResponse(
    senderID: string,
    { text }: VisualContent.MainContent.Text
  ): TelegramResponse.SendMessage {
    return { text, action: 'sendMessage', chat_id: senderID };
  }

  function createResponse(
    senderID: string,
    content: GenericResponse.Telegram<C>['visualContents'][number]['content']
  ) {
    switch (content.type) {
      case 'text':
        return createTextResponse(senderID, content);

      default:
        throw new Error(
          formatTelegramError(`Unsupported content ${JSON.stringify(content)}`)
        );
    }
  }

  function createPlatformResponse(
    senderID: string,
    { content }: GenericResponse<C>['visualContents'][number]
  ): TelegramResponse {
    return createResponse(senderID, content);
  }

  return visualContents.map(visualContent => {
    return createPlatformResponse(senderID, visualContent);
  });
}

/**
 * Create a Telegram messenger.
 * @template C The context used by the current chatbot.
 */
export async function createTelegramMessenger<C>(
  leafSelector: Leaf<C>,
  communicator: TelegramCommunicator,
  ...transformers: readonly Transformer<Messenger<C, TelegramRequest>>[]
): Promise<TelegramMessenger<C>> {
  await communicator.setWebhook();

  return createMessenger(
    'telegram',
    leafSelector,
    communicator,
    async req => createTelegramRequest(req, 'telegram'),
    async res => createTelegramResponse(res as GenericResponse.Telegram<C>),
    ...transformers
  );
}
