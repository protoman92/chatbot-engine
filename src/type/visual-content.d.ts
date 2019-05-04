interface BaseQuickReply {
  readonly text: string;
}

export namespace QuickReply {
  export interface Location extends BaseQuickReply {
    readonly type: 'location';
  }

  export interface SimpleText extends BaseQuickReply {
    readonly type?: 'text';
  }
}

/**
 * Represents a bubble of text that supports quick decision-making. This
 * concept is available only on certain platforms (Facebook/Telegram) but is
 * an important one nonetheless.
 */
export type QuickReply = QuickReply.Location | QuickReply.SimpleText;

interface BaseAction {
  readonly text: string;
}

declare namespace Action {
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

declare namespace Response {
  export interface Text {
    readonly text: string;
    readonly type?: 'text';
  }

  export interface Carousel {
    readonly actions: readonly Action[] | null;

    readonly items: Readonly<{
      title: string;
      description: string | null;
      mediaURL: string | null;
      actions: readonly Action[] | null;
    }>[];

    readonly type: 'carousel';
  }

  export interface List {
    readonly actions: readonly Action[] | null;

    readonly items: Readonly<{
      title: string;
      description: string | null;
      size: 'large' | 'small';
      actions: readonly Action[] | null;
    }>[];

    readonly type: 'list';
  }
}

/** Represents something the user receives after they send a message. */
export type Response = Response.Text | Response.Carousel | Response.List;

/** Represents content that will go out to the user. */
export interface VisualContent {
  readonly quickReplies?: readonly QuickReply[];
  readonly response: Response;
}
