import { PlatformCommunicator } from './communicator';
import { Messenger } from './messenger';

export type TelegramRequest = unknown;

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
