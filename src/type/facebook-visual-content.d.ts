import { QuickReply, Response, VisualContent } from './visual-content';

export type FacebookQuickReply = QuickReply;
export type FacebookResponse = Response;

export interface FacebookVisualContent extends VisualContent {
  readonly quickReplies?: readonly FacebookQuickReply[];
  readonly response: FacebookResponse;
}
