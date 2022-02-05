# @microbackend/plugin-chatbot-engine-express

Microbackend plugin to add support for
[chatbot-engine](https://github.com/protoman92/chatbot-engine) on
[express.js](https://www.npmjs.com/package/express).

## Dependency

- [@microbackend/plugin-express](https://www.npmjs.com/package/@microbackend/plugin-express).

## Installation

```shell
npx microbackend plugin add @microbackend/plugin-chatbot-engine-express
```

## Usage

### Configuration

Please view all the available configuration options in this plugin's
`src/index.ts`.

### Branch

Define new branches under `extension/chatbot_engine/branch`:

- Using `IMicrobackendBranchCreator`:

```typescript
import { createLeaf, NextResult } from "@haipham/chatbot-engine-core";
import { IMicrobackendBranchCreator } from "@microbackend/plugin-chatbot-engine-express";

export default ((): IMicrobackendBranchCreator => {
  return () => {
    return {
      branch: {
        respondToMessage: createLeaf((obs) => {
          return {
            next: async ({ input, targetID, targetPlatform }) => {
              if (input.type !== "text") {
                return NextResult.FALLTHROUGH;
              }

              await obs.next({
                targetID,
                targetPlatform,
                output: [
                  {
                    content: {
                      text: "Received your message",
                      type: "text",
                    },
                  },
                ],
              });

              return NextResult.BREAK;
            },
          };
        }),
      },
    };
  };
})();
```

- Using `MicrobackendBranch`:

```typescript
import { createLeaf, NextResult } from "@haipham/chatbot-engine-core";
import { MicrobackendBranch } from "@microbackend/plugin-chatbot-engine-express";

export default class PlaceholderBranch extends MicrobackendBranch {
  get branch(): MicrobackendBranch["branch"] {
    return {
      respondToMessage: createLeaf((obs) => {
        return {
          next: async ({ targetID, targetPlatform }) => {
            if (input.type !== "text") {
              return NextResult.FALLTHROUGH;
            }

            await obs.next({
              targetID,
              targetPlatform,
              output: [
                {
                  content: {
                    text: "Received your message",
                    type: "text",
                  },
                },
              ],
            });

            return NextResult.BREAK;
          },
        };
      }),
    };
  }
}
```

Please beware that branch extensions are registered in the order that they
appear in the `extension/chatbot_engine/branch` directory (i.e. alphabetically),
so if we want to maintain a specific order, we need to name the files in a way
that results in the order we want:

```
/extension
  /chatbot_engine
    /branch
      /1_first_branch.ts
      /2_second_branch.ts
```
