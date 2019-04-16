/**
 * Represents a bubble of text that supports quick decision-making. This
 * concept is available only on certain platforms (Facebook/Telegram) but is
 * an important one nonetheless.
 */
export type QuickReply = Readonly<{ text: string }>;

type BaseAction = Readonly<{ text: string }>;

declare namespace Action {
  export type Postback = BaseAction &
    Readonly<{ payload: string; type: 'postback' }>;

  export type URL = BaseAction & Readonly<{ url: string; type: 'url' }>;
}

/** Does something, like communicating with a remote service. */
export type Action = Action.Postback | Action.URL;

declare namespace Response {
  export type Text = Readonly<{ text: string }>;

  export type Carousel = Readonly<{
    items: Readonly<{
      title: string;
      description?: string;
      media_url?: string;
      actions?: Action[];
    }>[];

    type: 'carousel';
    actions?: Action[];
  }>;

  export type List = Readonly<{
    items: Readonly<{
      title: string;
      description?: string;
      size?: 'large' | 'small';
      actions?: Action[];
    }>[];

    type: 'list';
    actions?: Action[];
  }>;
}

/** Represents something the user receives after they send a message. */
export type Response = Response.Text | Response.Carousel | Response.List;

/** Represents content that will go out to the user. */
export type OutgoingContent = Readonly<{
  quickReplies: QuickReply[];
  response: Response;
}>;
