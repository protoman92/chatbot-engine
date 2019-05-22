import { PlatformCommunicator } from './communicator';
import { BatchMessenger, Messenger } from './messenger';

declare namespace TelegramRequest {
  namespace Input {
    interface Base {
      readonly message_id: number;

      readonly from: Readonly<{
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name: string;
        username: string;
        language_code: 'en';
      }>;

      readonly chat: Readonly<{
        id: number;
        first_name: string;
        last_name: string;
        username: string;
        type: 'private';
      }>;
    }

    interface Text extends Base {
      readonly text: string;
    }
  }

  type Input = Input.Text;
}

export interface TelegramRequest {
  readonly update_id: number;
  readonly message: TelegramRequest.Input;
}

declare namespace TelegramResponse {
  namespace Keyboard {
    interface Button {
      readonly text: string;
      readonly request_contact: boolean | undefined;
      readonly request_location: boolean | undefined;
    }

    interface ReplyMarkup {
      readonly keyboard: readonly (readonly Button[])[];
      readonly resize_keyboard: boolean | undefined;
      readonly one_time_keyboard: boolean | undefined;
      readonly selective: boolean | undefined;
    }
  }

  interface HasReplyMarkup {
    readonly reply_markup: Keyboard.ReplyMarkup | undefined;
  }

  interface SendMessage extends HasReplyMarkup {
    readonly action: 'sendMessage';
    readonly chat_id: string;
    readonly text: string;
  }
}

export type TelegramResponse = TelegramResponse.SendMessage;

/** Represents Telegram configurations. */
export interface TelegramConfigs {
  readonly authToken: string;
  readonly webhookURL: string;
}

/** A Telegram-specific communicator. */
export interface TelegramCommunicator
  extends PlatformCommunicator<TelegramResponse> {
  /** Set webhook to start receiving message updates. */
  setWebhook(): Promise<unknown>;
}

/**
 * Represents a Telegram-specific messenger.
 * @template C The context used by the current chatbot.
 */
export interface TelegramMessenger<C> extends Messenger<C, TelegramRequest> {}
