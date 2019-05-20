import { PlatformCommunicator } from './communicator';
import { UnitMessenger } from './messenger';

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
}

/** A Telegram-specific communicator. */
export interface TelegramCommunicator
  extends PlatformCommunicator<TelegramResponse> {}

/**
 * Represents a Telegram-specific unit messenger.
 * @template C The context used by the current chatbot.
 */
export interface TelegramUnitMessenger<C> extends UnitMessenger<C> {}
