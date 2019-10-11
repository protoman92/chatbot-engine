import defaultAxiosCommunicator from "./axios-communicator";
import defaultFacebookCommunicator from "./facebook-communicator";
import defaultTelegramCommunicator from "./telegram-communicator";
import defaultWitCommunicator from "./wit-communicator";
export { createAxiosCommunicator } from "./axios-communicator";
export { createFacebookCommunicator } from "./facebook-communicator";
export { createFacebookMessageProcessor } from "./facebook-messenger";
export { saveFacebookUser } from "./facebook-transform";
export { createCrossPlatformMessenger } from "./generic-messenger";
export { transformMessageProcessorsDefault } from "./messenger-transform";
export { createTelegramCommunicator } from "./telegram-communicator";
export { createTelegramMessageProcessor } from "./telegram-messenger";
export { saveTelegramUser } from "./telegram-transform";
export { createWitCommunicator } from "./wit-communicator";
export {
  defaultWitCommunicator,
  defaultAxiosCommunicator,
  defaultFacebookCommunicator,
  defaultTelegramCommunicator
};
