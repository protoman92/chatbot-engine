import { createLeaf, NextResult } from "@haipham/chatbot-engine-core";
import { MicrobackendBranch } from "@microbackend/plugin-chatbot-engine-express";

export default class CatchAllBranch extends MicrobackendBranch {
  get branch(): MicrobackendBranch["branch"] {
    return {
      catchAll: createLeaf((obs) => {
        return {
          next: async ({ targetID, targetPlatform }) => {
            await obs.next({
              targetID,
              targetPlatform,
              output: [{ content: { text: "Catch-all", type: "text" } }],
            });

            return NextResult.BREAK;
          },
        };
      }),
    };
  }
}
