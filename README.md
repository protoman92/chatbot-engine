# chatbot-engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/protoman92/chatbot-engine.svg?branch=master)](https://travis-ci.org/protoman92/chatbot-engine)
[![Coverage Status](https://coveralls.io/repos/github/protoman92/chatbot-engine/badge.svg?branch=master)](https://coveralls.io/github/protoman92/chatbot-engine?branch=master)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Experimental chatbot engine to build cross-platform chatbots.

## Sequence of response selection

### Receive platform request

Request is received from a supported platform, and mapped to an `Array` of `AmbiguousRequest`. An `AmbiguousRequest` contains the `senderID`, `currentContext` and supported data.

### Feed request to leaf selector

A `LeafSelector` scans through all leaves and picks out the one whose conditions match the request input.

### Map responses and send the resulting raw responses back

The resulting `AmbiguousResponse` instances are then mapped to the payload specified by supported platforms, then sent back to the user.

## Setting up

### Set up the context DAO

The context DAO is a DAO that handles the bot's state. This state can be used to control the bot's behavior (like control flows) by using flags to guide it towards specific responses.

Currently there are several out-of-the-box ways to manage state:

- In-memory context DAO: this is useful for testing.
- Redis context DAO: this uses Redis to manage and fetch state efficiently.

```javascript
import { createRedisContextDAO } from "chatbot-engine/dist/context";
import { createClient as createRedisClient } from "redis";

const redisClient = createRedisClient({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "", undefined),
  url: process.env.REDIS_URL,
});

const fbContextDAO = createRedisContextDAO(redisClient, "facebook");
const tlContextDAO = createRedisContextDAO(redisClient, "telegram");
```

### Set up the platform client

Platform clients are HTTP clients that serve specific platforms. It requires a base client that supports basic HTTP verbs (such as one supported by axios).

They are capable of (but not restricted to):

- Sending messages to respective platform.
- Set typing indicator.
- Get current user.

```javascript
const client = createAxiosClient();

const fbClient = createFacebookClient(client, {
  apiVersion: process.env.FACEBOOK_API_VERSION,
  pageToken: process.env.FACEBOOK_PAGE_TOKEN,
  verifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
});

const tlClient = createTelegramClient(client, {
  authToken: process.env.TELEGRAM_AUTH_TOKEN,
});
```

### Set up branch/leaf logic

#### Sample leaf implementation

A branch contains many leaves, and potentially other sub-branches. Let's see how we can implement a simple leaf:

```javascript
export default function () {
  return {
    sayHello: createLeaf((observer) => ({
      /**
       * This request contains the information sent by the user, via the input
       * field. It also tells you the user's platform and ID.
       */
      next: async (request) => {
        /**
         * The target platform abstraction allows you to handle messages from
         * different platforms mostly the same way (i.e. when the input type
         * is common across all platforms, such as a text input type).
         *
         * Remember that the context object is an arbitrary key-value object.
         * It can be anything you want.
         */
        const { currentContext, input, targetID, targetPlatform } = request;

        if (input.type !== "text" || input.text.match(/hello/) == null) {
          /**
           * This leaf does not satisfy user's need, so fall through to the
           * next leaf.
           */
          return NextResult.FALLTHROUGH;
        }

        /**
         * A leaf is similar to an RX subject. Calling next on the observer
         * will trigger a message to be sent to this user.
         */
        await observer.next({
          targetID,
          targetPlatform,
          /**
           * If we specify additionalContext, this user's context will be
           * modified.
           */
          additionalContext: { counter: currentContext.counter + 1 },
          output: [{ content: { text: "Hello!", type: "text" } }],
        });

        /** Input was successfully handled, break the flow and return */
        return NextResult.BREAK;
      },
    })),
  };
}
```

In the above example, you'll see that an `additionalContext` was specified in `observer.next`. This will trigger a modification of the user's context object in persistence, and fire a `context_change` request that you can catch and process:

```javascript
export default function () {
  return {
    onCounterChangeTrigger: createLeaf((observer) => ({
      next: async (request) => {
        const { currentContext, input, targetID, targetPlatform } = request;

        /** The counter was changed by the previous leaf */
        if (
          input.type !== "context_change" ||
          input.changedContext.counter == null
        ) {
          return NextResult.FALLTHROUGH;
        }

        await observer.next({
          targetID,
          targetPlatform,
          output: [{ content: { text: "Counter was changed!", type: "text" } }],
        });

        return NextResult.BREAK;
      },
    })),
  };
}
```

This mechanism is especially useful when you want to trigger flows automatically after a new state. For example, you can implement a state machine for some input flow, which can be triggered from anywhere:

```javascript
export default function ({ appClient }: Config) {
  return {
    onStartEditingTrigger: createLeaf((observer) => ({
      next: async (request) => {
        const { currentContext, input, targetID, targetPlatform } = request;

        if (
          input.type !== "context_change" ||
          input.changedContext.edit_type !== "edit_profile"
        ) {
          return NextResult.FALLTHROUGH;
        }

        /**
         * Send a message to the user first before hitting DB to get their
         * information, in order to quickly give a feedback to their input.
         */
        await observer.next({
          targetID,
          targetPlatform,
          output: [
            { content: { text: "Starting profile edit", type: "text" } },
          ],
        });

        const user = await appClient.getUser(currentContext.user.id);

        /** No output, just context change. */
        await observer.next({
          targetID,
          targetPlatform,
          additionalContext: {
            editProfileFlow: {
              ...user,
              state: EditProfileState.ENTER_NAME,
            },
          },
          output: [],
        });

        return NextResult.BREAK;
      },
    })),
    onEnterNameTrigger: createLeaf((observer) => ({
      next: async (request) => {
        const { currentContext, input, targetID, targetPlatform } = request;

        if (
          input.type !== "context_change" ||
          input.changedContext.edit_type !== "edit_profile" ||
          input.changedContext.editProfileFlow?.state !==
            EditProfileState.ENTER_NAME
        ) {
          return NextResult.FALLTHROUGH;
        }

        /**
         * So instead of sending this message in onStartEditingTrigger, we send
         * it here to nicely encapsulate the ENTER_NAME logic.
         */
        await observer.next({
          targetID,
          targetPlatform,
          output: [{ content: { text: "What is your name", type: "text" } }],
        });

        /** Input was successfully handled, break the flow and return */
        return NextResult.BREAK;
      },
    })),
  };
}
```

This is pretty similar to how [Redux](https://github.com/reduxjs/redux) manages its state.

#### Set up the branches

After you have the leaves ready, the branches are easy to set up:

```javascript
export default function (args: Config) {
  return {
    editProfile: createEditProfile(args),
    sayHello: createSayHello(),
  };
}
```

#### Set up the leaf selector

The leaf selector receives requests and selects the most appropriate leaf that match the requirements of each request (such as those imposed by regex matches, state flags etc):

```javascript
const branches = await createBranches(args);

const leafSelector = await createTransformChain()
  .pipe(catchError(await createDefaultErrorLeaf()))
  .transform(createLeafSelector(branches));
```

### Set up platform message processors

The platform message processors are responsible for receiving platform requests and sending platform responses. They are capable of:

- Process raw requests (which differ from one platform to another) into ambiguous requests.
- Pass ambiguous requests to leaf selector to produce ambiguous resposnes.
- Process ambiguous responses to raw responses.
- Use platform clients to send raw responses to the respective platform.

```javascript
const fbMessageProcessor = await createFacebookMessageProcessor(
  leafSelector,
  fbClient,
  transformMessageProcessorsDefault(fbContextDAO, fbClient)
);

const tlMessageProcessor = await createTelegramMessageProcessor(
  leafSelector,
  tlClient,
  transformMessageProcessorsDefault(tlContextDAO, tlClient)
);
```

### Set up a master cross-platform message processor

A cross-platform message processor allows platforms to send messages to each other using `targetPlatform` variable in the request input. It can then be fed to a messenger, an abstraction that uses a message processor under the hood.

```javascript
const crossProcessor = createCrossPlatformMessageProcessor({
  facebook: fbMessenger,
  telegram: tlMessenger,
});

const messenger = createMessenger(crossProcessor);

/**
 * The messenger implements the observer interface, so you need to call
 * subscribe on it to start the engine. The resulting subscription object can
 * be used to clean up after the server stops.
 */
const subscription = messenger.subscribe({
  next: console.log,
});
```

### Set up the server

We can use a simple express server to listen to webhook payload and process platform requests with the cross-platform messenger:

```javascript
const app = express();
app.use(json());

app.get("/api/facebook", async ({ query }, res) => {
  const challenge = await fbClient.resolveVerifyChallenge(query);
  res.status(200).send(challenge);
});

app.post("/api/facebook", async ({ body }, res) => {
  await messenger.next(body);
  res.sendStatus(204);
});

app.post("/api/telegram", async ({ body }, res) => {
  await messenger.next(body);
  res.sendStatus(204);
});

const port = process.env.PORT || 8000;
await new Promise((resolve) => app.listen(port, resolve));
```
