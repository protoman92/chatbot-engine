import express from "express";
import { ChatbotBootstrapArgs } from "..";
import { AmbiguousPlatform } from "../../type";
import { DefaultLeafResolverArgs } from "../interface";

export default function <
  Context,
  LeafResolverArgs extends DefaultLeafResolverArgs<Context>
>({
  getMessengerComponents,
  onWebhookError,
}: ChatbotBootstrapArgs<Context, LeafResolverArgs, unknown> &
  DefaultLeafResolverArgs<Context>) {
  const router = express.Router();

  router.get("/webhook/facebook", async ({ query }, res) => {
    const { facebookClient } = await getMessengerComponents();
    const challenge = await facebookClient.resolveVerifyChallenge(query);
    res.status(200).send(challenge);
  });

  router.post(
    "/webhook/:platform",
    async ({ body, params: { platform } }, res) => {
      const { messenger } = await getMessengerComponents();

      try {
        await messenger.processRawRequest(body);
      } catch (error) {
        await onWebhookError({
          error,
          payload: body,
          platform: platform as AmbiguousPlatform,
        });
      }

      res.sendStatus(200);
    }
  );

  return router;
}
