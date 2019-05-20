export namespace GenericQuickReply {
  interface Base {
    readonly text: string;
  }

  export interface Location extends Base {
    readonly type: 'location';
  }

  export interface Postback extends Base {
    readonly payload: string;
    readonly type: 'postback';
  }

  export interface SimpleText extends Base {
    readonly type: 'text';
  }
}

/**
 * Represents a bubble of text that supports quick decision-making. This
 * concept is available only on certain platforms (Facebook/Telegram) but is
 * an important one nonetheless.
 */
export type GenericQuickReply =
  | GenericQuickReply.Location
  | GenericQuickReply.Postback
  | GenericQuickReply.SimpleText;

export namespace GenericSubContent {
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

declare namespace GenericContent {
  export interface Button {
    readonly actions: readonly GenericSubContent.Action[];
    readonly text: string;
    readonly type: 'button';
  }

  interface Carousel {
    readonly actions: readonly GenericSubContent.Action[] | undefined | null;

    readonly items: Readonly<{
      title: string;
      description: string | undefined | null;
      mediaURL: string | undefined | null;
      actions: readonly GenericSubContent.Action[] | undefined | null;
    }>[];

    readonly type: 'carousel';
  }

  interface List {
    readonly actions: readonly GenericSubContent.Action[] | undefined | null;

    readonly items: Readonly<{
      title: string;
      description: string | undefined | null;
      size: 'large' | 'small';
      actions: readonly GenericSubContent.Action[] | undefined | null;
    }>[];

    readonly type: 'list';
  }

  interface Media {
    readonly media: GenericSubContent.Media;
    readonly type: 'media';
  }

  interface Text {
    readonly text: string;
    readonly type: 'text';
  }
}

/** Represents something the user receives after they send a message. */
export type GenericContent =
  | GenericContent.Button
  | GenericContent.Carousel
  | GenericContent.List
  | GenericContent.Media
  | GenericContent.Text;

/** Represents content that will go out to the user. */
export interface VisualContent {
  readonly quickReplies?: readonly GenericQuickReply[];
  readonly content: GenericContent;
}
