import defaultAxiosClient from "./axios-client";
import defaultFacebookClient from "./facebook-client";
import defaultTelegramClient from "./telegram-client";
import defaultWitClient from "./wit-client";
export { createAxiosClient } from "./axios-client";
export { createFacebookClient } from "./facebook-client";
export { createFacebookMessageProcessor } from "./facebook-messenger";
export { saveFacebookUser } from "./facebook-transform";
export {
  createCrossPlatformMessageProcessor,
  createMessenger,
} from "./generic-messenger";
export {
  injectContextOnReceive,
  saveContextOnSend,
  saveUserForTargetID,
  setTypingIndicator,
} from "./messenger-transform";
export { createTelegramClient } from "./telegram-client";
export { createTelegramMessageProcessor } from "./telegram-messenger";
export { saveTelegramUser } from "./telegram-transform";
export { createWitClient } from "./wit-client";
export {
  defaultWitClient,
  defaultAxiosClient,
  defaultFacebookClient,
  defaultTelegramClient,
};
