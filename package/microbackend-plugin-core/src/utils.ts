import { _ErrorLeafConfig } from "@haipham/chatbot-engine-core";

export const PLUGIN_NAME = "@microbackend/plugin-chatbot-engine-core";

export class LeafHandlingError
  extends Error
  implements Omit<_ErrorLeafConfig.TrackErrorArgs, "error">
{
  erroredLeaf: _ErrorLeafConfig.TrackErrorArgs["erroredLeaf"];
  targetID: _ErrorLeafConfig.TrackErrorArgs["targetID"];
  targetPlatform: _ErrorLeafConfig.TrackErrorArgs["targetPlatform"];

  constructor({
    error,
    erroredLeaf,
    targetID,
    targetPlatform,
  }: _ErrorLeafConfig.TrackErrorArgs) {
    super(error.message);
    this.stack = error.stack;
    this.erroredLeaf = erroredLeaf;
    this.targetID = targetID;
    this.targetPlatform = targetPlatform;
  }
}
