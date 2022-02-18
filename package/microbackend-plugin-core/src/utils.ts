import { ErrorLeafTrackErrorArgs } from "@haipham/chatbot-engine-core";

export const PLUGIN_NAME = "@microbackend/plugin-chatbot-engine-core";

export class LeafHandlingError
  extends Error
  implements Omit<ErrorLeafTrackErrorArgs, "error">
{
  erroredLeaf: ErrorLeafTrackErrorArgs["erroredLeaf"];
  targetID: ErrorLeafTrackErrorArgs["targetID"];
  targetPlatform: ErrorLeafTrackErrorArgs["targetPlatform"];

  constructor({
    error,
    erroredLeaf,
    targetID,
    targetPlatform,
  }: ErrorLeafTrackErrorArgs) {
    super(error.message);
    this.stack = error.stack;
    this.erroredLeaf = erroredLeaf;
    this.targetID = targetID;
    this.targetPlatform = targetPlatform;
  }
}
