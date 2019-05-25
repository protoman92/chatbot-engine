import { PlatformCommunicator } from './communicator';
import { Messenger as RootMessenger } from './messenger';
import { GenericRequest as RootGenericRequest } from './request';
import { GenericResponse as RootGenericResponse } from './response';
import { VisualContent as RootVisualContent } from './visual-content';
import { Omit } from 'ts-essentials';

export namespace Telegram {
  namespace GenericRequest {
    interface Data extends RootGenericRequest.Data.Base {
      readonly targetPlatform: 'telegram';
    }
  }

  interface GenericRequest<C> extends RootGenericRequest.Base<C> {
    readonly targetPlatform: 'telegram';
    readonly data: readonly GenericRequest.Data[];
  }

  interface GenericResponse<C> extends RootGenericResponse.Base<C> {
    readonly targetPlatform: 'telegram';
    readonly visualContents: readonly VisualContent[];
  }

  namespace VisualContent {
    type QuickReply = RootVisualContent.QuickReply;
  }

  interface VisualContent extends RootVisualContent.Base {
    readonly quickReplies?: readonly (readonly VisualContent.QuickReply[])[];
  }

  namespace PlatformRequest {
    namespace Input {
      interface Base {
        readonly message_id: number;
        readonly from: User;

        readonly chat: Omit<User, 'language_code' | 'is_bot'> &
          Readonly<{ type: 'private' }>;
      }

      interface Text extends Base {
        readonly text: string;
      }
    }

    type Input = Input.Text;
  }

  interface PlatformRequest {
    readonly update_id: number;
    readonly message: PlatformRequest.Input;
  }

  namespace PlatformResponse {
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

  type PlatformResponse = PlatformResponse.SendMessage;

  interface User {
    readonly id: number;
    readonly first_name: string;
    readonly last_name: string;
    readonly username: string;
    readonly is_bot: boolean;
    readonly language_code: 'en';
  }

  /** Represents Telegram configurations. */
  interface Configs {
    readonly authToken: string;
    readonly webhookURL: string;
  }

  namespace Communicator {
    namespace APIResponse {
      interface Base {
        readonly description: string;
      }

      interface Success extends Base {
        readonly ok: true;
        readonly result: unknown;
      }

      interface Failure extends Base {
        readonly ok: false;
      }
    }

    type APIResponse = APIResponse.Success | APIResponse.Failure;
  }

  /** A Telegram-specific communicator. */
  interface Communicator extends PlatformCommunicator<PlatformResponse> {
    /** Set webhook to start receiving message updates. */
    setWebhook(): Promise<unknown>;
  }

  /**
   * Represents a Telegram-specific messenger.
   * @template C The context used by the current chatbot.
   */
  interface Messenger<C> extends RootMessenger<C, PlatformRequest> {}
}
