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
  }

  export interface Carousel {
    readonly items: Readonly<{
      title: string;
      description?: string;
      media_url?: string;
      actions?: Action[];
    }>[];

    readonly type: 'carousel';
    readonly actions?: Action[];
  }

  export interface List {
    readonly items: Readonly<{
      title: string;
      description?: string;
      size?: 'large' | 'small';
      actions?: Action[];
    }>[];

    readonly type: 'list';
    readonly actions?: Action[];
  }
}

/** Represents something the user receives after they send a message. */
export type Response = Response.Text | Response.Carousel | Response.List;
