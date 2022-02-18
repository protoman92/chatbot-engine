import { createLeaf, NextResult } from "@haipham/chatbot-engine-core";
import { IMicrobackendBranchCreator } from "@microbackend/plugin-chatbot-engine-core";

export default ((): IMicrobackendBranchCreator => {
  return () => {
    return {
      branch: {
        triggerError: createLeaf(() => {
          return {
            next: async ({ input }) => {
              if (
                input.type !== "command" ||
                input.command !== "trigger_leaf_error"
              ) {
                return NextResult.FALLTHROUGH;
              }

              throw new Error("Debug error triggered from leaf");
            },
          };
        }),
      },
    };
  };
})();
