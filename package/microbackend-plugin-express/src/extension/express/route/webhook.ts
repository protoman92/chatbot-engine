import { AmbiguousPlatform } from "@haipham/chatbot-engine-core";
import {
  handleExpressError,
  MicrobackendRoute,
} from "@microbackend/plugin-express";
import express from "express";
import { WebhookHandlingError } from "../../../utils";

export default class WebhookRoute extends MicrobackendRoute {
  get handler(): MicrobackendRoute["handler"] {
    const router = express.Router();
    router.use(express.json());

    if (this.app.config.chatbotEngine.messenger.facebook.isEnabled) {
      router.get(
        this.app.config.chatbotEngineExpress.webhook.facebook.challengeRoute,
        handleExpressError(async (req, res) => {
          const challenge =
            await req.app.chatbotEngine.facebookClient.resolveVerifyChallenge(
              req.query
            );

          res.status(200).send(challenge);
        })
      );
    }

    router.post(
      this.app.config.chatbotEngineExpress.webhook.handlerRoute,
      handleExpressError(async (req, res) => {
        const messenger = await req.chatbotEngine.messenger;

        try {
          await Promise.race([
            messenger.processRawRequest({ rawRequest: req.body }),
            (async () => {
              await new Promise((resolve) => {
                setTimeout(() => {
                  resolve(undefined);
                }, req.config.chatbotEngineExpress.webhook.timeoutMs);
              });

              throw new Error("Webhook timed out");
            })(),
          ]);
        } catch (error) {
          await req.config.chatbotEngineExpress.webhook.onError?.call(
            undefined,
            new WebhookHandlingError(
              error,
              req.body,
              req.params["platform"] as AmbiguousPlatform
            )
          );
        }

        /** Must always respond with 200 for service provider */
        res.sendStatus(200);
      })
    );

    return router;
  }

  route = "/";
}
