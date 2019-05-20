import {
  GenericQuickReply,
  GenericContent,
  VisualContent
} from './visual-content';

export type FacebookQuickReply = GenericQuickReply;
export type FacebookContent = GenericContent;

export interface FacebookVisualContent extends VisualContent {
  readonly quickReplies?: readonly FacebookQuickReply[];
  readonly content: FacebookContent;
}
