# chatbot-engine

Experimental chatbot engine to build cross-platform chatbots.

## Sequence of response selection

### Receive platform request

Request is received from a supported platform, and mapped to an `Array` of `GenericRequest`. A `GenericRequest` contains the `senderID`, `oldContext` and supported data.

### Feed generic request to leaf selector

A `LeafSelector` scans through all leaves and picks out the one whose conditions match the request input.

### Map generic responses and send the resulting responses back

The resulting `GenericResponse` instances are then mapped to the payload specified by supported platforms, then sent back to the user.

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
  url: process.env.REDIS_URL
});

const fbContextDAO = createRedisContextDAO(redisClient, "facebook");
const tlContextDAO = createRedisContextDAO(redisClient, "telegram");
```

### Set up the platform communicator

Platform communicators are HTTP communicators that serve specific platforms. It requires a base communicator that supports basic HTTP verbs (such as one supported by axios).

They are capable of (but not restricted to):

- Sending messages to respective platform.
- Set typing indicator.
- Get current user.

```javascript
const communicator = createAxiosCommunicator();

const fbCommunicator = createFacebookCommunicator(communicator, {
  apiVersion: process.env.FACEBOOK_API_VERSION,
  pageToken: process.env.FACEBOOK_PAGE_TOKEN,
  verifyToken: process.env.FACEBOOK_VERIFY_TOKEN
});

const tlCommunicator = createTelegramCommunicator(communicator, {
  authToken: process.env.TELEGRAM_AUTH_TOKEN,
  webhookURL: `${process.env.TELEGRAM_WEBHOOK_URL}/api/telegram`
});
```

### Set up the leaf selector

The leaf selector receives platform requests and selects the most appropriate leaf that match the requirements of each request (such as those imposed by regex matches, state flags etc):

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

- Process raw platform requests (which differ from platform to another) into generic requests.
- Pass generic requests to leaf selector to produce generic resposnes.
- Process generic responses to platform responses.
- Use platform communicators to send platform responses to the respective platform.

```javascript
const fbMessageProcessor = await createFacebookMessageProcessor(
  leafSelector,
  fbCommunicator,
  transformMessageProcessorsDefault(fbContextDAO, fbCommunicator)
);

const tlMessageProcessor = await createTelegramMessageProcessor(
  leafSelector,
  tlCommunicator,
  transformMessageProcessorsDefault(tlContextDAO, tlCommunicator)
);
```

### Set up a master cross-platform messenger

A messenger is an abstraction that uses platform message processors under the hood. A cross-platform messenger allows platforms to send messages to each other using `targetPlatform` variable in the request input:

```javascript
const crossMessenger = createCrossPlatformMessenger({
  facebook: fbMessenger,
  telegram: tlMessenger
});
```

### Set up the server

We can use a simple express server to listen to webhook payload and process platform requests with the cross-platform messenger:

```javascript
const app = express();
app.use(json());

app.get("/api/facebook", async ({ query }, res) => {
  const challenge = await fbCommunicator.resolveVerifyChallenge(query);
  res.status(200).send(challenge);
});

app.post("/api/facebook", async ({ body }, res) => {
  try {
    await crossMessenger.processPlatformRequest(body);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post("/api/telegram", async ({ body }, res) => {
  try {
    await crossMessenger.processPlatformRequest(body);
    res.status(200).send("Message sent");
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

const port = process.env.PORT || 8000;
await new Promise(resolve => app.listen(port, resolve));
```
