import { Facebook } from './facebook';
import { Telegram } from './telegram';

declare namespace VisualContent {
  namespace QuickReply {
    interface Base {
      readonly text: string;
    }

    interface Location extends Base {
      readonly type: 'location';
    }

    interface SimpleText extends Base {
      readonly type: 'text';
    }
  }

  /**
   * Represents a bubble of text that supports quick decision-making. This
   * concept is available only on certain platforms (Facebook/Telegram) but is
   * an important one nonetheless.
   */
  type QuickReply = QuickReply.Location | QuickReply.SimpleText;

  namespace SubContent {
    namespace Action {
      interface Base {
        readonly text: string;
      }

      interface Postback extends Base {
        readonly payload: string;
        readonly type: 'postback';
      }

      interface URL extends Base {
        readonly url: string;
        readonly type: 'url';
      }
    }

    /** Does something, like communicating with a remote service. */
    type Action = Action.Postback | Action.URL;

    interface Media {
      readonly type: 'image' | 'video';
      readonly url: string;
    }
  }

  namespace MainContent {
    interface Button {
      readonly actions: readonly SubContent.Action[];
      readonly text: string;
      readonly type: 'button';
    }

    interface Carousel {
      readonly actions: readonly SubContent.Action[] | undefined | null;

      readonly items: Readonly<{
        title: string;
        description: string | undefined | null;
        mediaURL: string | undefined | null;
        actions: readonly SubContent.Action[] | undefined | null;
      }>[];

      readonly type: 'carousel';
    }

    interface List {
      readonly actions: readonly SubContent.Action[] | undefined | null;

      readonly items: Readonly<{
        title: string;
        description: string | undefined | null;
        size: 'large' | 'small';
        actions: readonly SubContent.Action[] | undefined | null;
      }>[];

      readonly type: 'list';
    }

    interface Media {
      readonly media: SubContent.Media;
      readonly type: 'media';
    }

    interface Text {
      readonly text: string;
      readonly type: 'text';
    }
  }

  /** Represents something the user receives after they send a message. */
  type MainContent =
    | MainContent.Button
    | MainContent.Carousel
    | MainContent.List
    | MainContent.Media
    | MainContent.Text;

  interface Base {
    readonly content: VisualContent.MainContent;
  }
}

/** Represents content that will go out to the user. */
export type VisualContent = Facebook.VisualContent | Telegram.VisualContent;
