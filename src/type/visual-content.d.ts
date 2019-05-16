interface BaseQuickReply {
  readonly text: string;
}

export namespace QuickReply {
  export interface Location extends BaseQuickReply {
    readonly type: 'location';
  }

  export interface Postback extends BaseQuickReply {
    readonly payload: string;
    readonly type: 'postback';
  }

  export interface SimpleText extends BaseQuickReply {
    readonly type: 'text';
  }
}

/**
 * Represents a bubble of text that supports quick decision-making. This
 * concept is available only on certain platforms (Facebook/Telegram) but is
 * an important one nonetheless.
 */
export type QuickReply =
  | QuickReply.Location
  | QuickReply.Postback
  | QuickReply.SimpleText;

export namespace ResponseContent {
  interface BaseAction {
    readonly text: string;
  }

  namespace Action {
    export interface Postback extends BaseAction {
      readonly payload: string;
      readonly type: 'postback';
    }

    export interface URL extends BaseAction {
      readonly url: string;
      readonly type: 'url';
    }
  }

  /** Does something, like communicating with a remote service. */
  export type Action = Action.Postback | Action.URL;

  interface Media {
    readonly type: 'image' | 'video';
    readonly url: string;
  }
}

declare namespace Response {
  export interface Button {
    readonly actions: readonly ResponseContent.Action[];
    readonly text: string;
    readonly type: 'button';
  }

  export interface Carousel {
    readonly actions: readonly ResponseContent.Action[] | undefined | null;

    readonly items: Readonly<{
      title: string;
      description: string | undefined | null;
      mediaURL: string | undefined | null;
      actions: readonly ResponseContent.Action[] | undefined | null;
    }>[];

    readonly type: 'carousel';
  }

  export interface List {
    readonly actions: readonly ResponseContent.Action[] | undefined | null;

    readonly items: Readonly<{
      title: string;
      description: string | undefined | null;
      size: 'large' | 'small';
      actions: readonly ResponseContent.Action[] | undefined | null;
    }>[];

    readonly type: 'list';
  }

  export interface Media {
    readonly media: ResponseContent.Media;
    readonly type: 'media';
  }

  export interface Text {
    readonly text: string;
    readonly type: 'text';
  }
}

/** Represents something the user receives after they send a message. */
export type Response =
  | Response.Button
  | Response.Carousel
  | Response.List
  | Response.Media
  | Response.Text;

/** Represents content that will go out to the user. */
export interface VisualContent {
  readonly quickReplies?: readonly QuickReply[];
  readonly response: Response;
}
