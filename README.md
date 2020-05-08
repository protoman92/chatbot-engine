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
  webhookURL: `${process.env.TELEGRAM_WEBHOOK_URL}/api/telegram`,
});
```

### Set up the leaf selector

The leaf selector receives requests and selects the most appropriate leaf that match the requirements of each request (such as those imposed by regex matches, state flags etc):

```javascript
const branches = {
  a: {
    subBranches: {
      aSubBranch: {}
    }
    leaves: aLeaves
  }
};

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
  await messenger.processPlatformRequest(body);
  res.sendStatus(204);
});

app.post("/api/telegram", async ({ body }, res) => {
  await messenger.processPlatformRequest(body);
  res.sendStatus(204);
});

const port = process.env.PORT || 8000;
await new Promise((resolve) => app.listen(port, resolve));
```
