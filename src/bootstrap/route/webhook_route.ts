import express from "express";
import { ChatbotBootstrapArgs } from "..";
import { AmbiguousPlatform } from "../../type";
import { DefaultLeafDependencies } from "../interface";

export default function <
  Context,
  LeafResolverArgs extends DefaultLeafDependencies<Context>
>({
  getMessengerComponents,
  onWebhookError,
}: ChatbotBootstrapArgs<Context, LeafResolverArgs> &
  DefaultLeafDependencies<Context>) {
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
