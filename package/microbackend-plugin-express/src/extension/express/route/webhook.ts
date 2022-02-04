import { AmbiguousPlatform } from "@haipham/chatbot-engine-core";
import {
  handleExpressError,
  MicrobackendRoute,
} from "@microbackend/plugin-express";
import express from "express";
import {
  DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
  DEFAULT_WEBHOOK_HANDLER_ROUTE,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
} from "../../../utils";

export default class WebhookRoute extends MicrobackendRoute {
  get handler(): MicrobackendRoute["handler"] {
    const router = express.Router();

    const webhookTimeout =
      this.args.app.config.chatbotEngine.webhookTimeoutMs ||
      DEFAULT_WEBHOOK_TIMEOUT_MS;

    router.get(
      this.args.app.config.chatbotEngine.facebook.webhookChallengeRoute ||
        DEFAULT_FACEBOOK_WEBHOOK_CHALLENGE_ROUTE,
      handleExpressError(async (req, res) => {
        const challenge = await req.app.chatbotEngine.facebookClient.resolveVerifyChallenge(
          req.query
        );

        res.status(200).send(challenge);
      })
    );

    router.post(
      this.args.app.config.chatbotEngine.webhookHandlerRoute ||
        DEFAULT_WEBHOOK_HANDLER_ROUTE,
      handleExpressError(async (req, res) => {
        const messenger = await req.chatbotEngine.messenger;

        try {
          await Promise.race([
            messenger.processRawRequest(req.body),
            (async function () {
              await new Promise((resolve) => {
                setTimeout(() => resolve(undefined), webhookTimeout);
              });

              throw new Error("Webhook timed out");
            })(),
          ]);
        } catch (error) {
          await this.args.app.config.chatbotEngine.onWebhookError?.call(
            undefined,
            {
              error,
              payload: req.body,
              platform: req.params["platform"] as AmbiguousPlatform,
            }
          );
        }

        /** Must always respond with 200 for service provider */
        res.sendStatus(200);
      })
    );

    return router;
  }

  get route(): MicrobackendRoute["route"] {
    return "/";
  }
}
