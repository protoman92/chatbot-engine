import express from "express";
import { DefaultLeafResolverArgs } from "../interface";

export default function <Context>({
  getMessengerComponents,
  handleError,
}: DefaultLeafResolverArgs<Context>) {
  const router = express.Router();

  router.get("/webhook/facebook", async ({ query }, res) => {
    const { facebookClient } = await getMessengerComponents();
    const challenge = await facebookClient.resolveVerifyChallenge(query);
    res.status(200).send(challenge);
  });

  router.post("/webhook/:platform", async ({ body, params: {} }, res) => {
    const { messenger } = await getMessengerComponents();

    try {
      await messenger.processRawRequest(body);
    } catch (error) {
      await handleError(error);
    }

    res.sendStatus(200);
  });

  return router;
}
