import express from "express";
import { AmbiguousPlatform } from "../../type";
import { DefaultLeafDependencies, OnWebhookErrorHandler } from "../interface";

export default function <
  Context,
  LeafDependencies extends DefaultLeafDependencies<Context>
>({
  facebookClient,
  getAsyncDependencies,
  onWebhookError,
  webhookTimeout,
}: LeafDependencies & Readonly<{ onWebhookError: OnWebhookErrorHandler }>) {
  const router = express.Router();

  router.get("/webhook/facebook", async ({ query }, res) => {
    const challenge = await facebookClient.resolveVerifyChallenge(query);
    res.status(200).send(challenge);
  });

  router.post(
    "/webhook/:platform",
    async ({ body, params: { platform } }, res) => {
      const { messenger } = await getAsyncDependencies();

      try {
        await Promise.race([
          messenger.processRawRequest(body),
          (async function () {
            await new Promise((resolve) => {
              setTimeout(() => resolve(undefined), webhookTimeout);
            });

            throw new Error("Webhook timed out");
          })(),
        ]);
      } catch (error) {
        await onWebhookError({
          error: error as any,
          payload: body,
          platform: platform as AmbiguousPlatform,
        });
      }

      res.sendStatus(200);
    }
  );

  return router;
}
