import { ContentSubscription } from "@haipham/chatbot-engine-core";
import { MicrobackendRequestLifecycle } from "@microbackend/plugin-core";

export default class RequestLifecycle extends MicrobackendRequestLifecycle {
  private subscription?: ContentSubscription;

  override async init() {
    const messenger = await this.req.chatbotEngine.messenger;
    this.subscription = await messenger.subscribe({ next: () => {} });
  }

  override async deinit() {
    await this.subscription?.unsubscribe();
  }
}
