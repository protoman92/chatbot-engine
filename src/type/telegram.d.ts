import { PlatformCommunicator } from './communicator';

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
