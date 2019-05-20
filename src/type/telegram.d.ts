import { DeepReadonly } from 'ts-essentials';
import { PlatformCommunicator } from './communicator';
import { Messenger } from './messenger';
import { VisualContent } from './visual-content';

export interface TelegramVisualContent extends VisualContent {
  readonly quickReplies?: readonly VisualContent.QuickReply[];
  readonly content: VisualContent.MainContent;
}

declare namespace TelegramRequest {
  interface Base {
    readonly update_id: number;

    readonly message: DeepReadonly<{
      message_id: number;
      from: {
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name: string;
        username: string;
        language_code: 'en';
      };
      chat: {
        id: number;
        first_name: string;
        last_name: string;
        username: string;
        type: 'private';
      };
      date: number;
    }>;
  }

  interface Text extends Base {
    readonly text: string;
  }
}

export type TelegramRequest = TelegramRequest.Text;

declare namespace TelegramResponse {
  interface SendMessage {
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
export interface TelegramMessenger<C> extends Messenger<C> {}
