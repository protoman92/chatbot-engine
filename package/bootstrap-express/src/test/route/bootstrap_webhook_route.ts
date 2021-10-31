import { inMemoryContextDAO } from "@haipham/chatbot-engine-core/src/context/InMemoryContextDAO";
import express from "express";
import { DefaultLeafDependencies } from "../../interface";
import { mockFacebookClient } from "../client/facebook_client";
import { mockResponseCapturer } from "../middleware/capture_generic_response";

export default function <Context>({
  getAsyncDependencies,
}: DefaultLeafDependencies<Context>) {
  const router = express.Router();

  router.post("/webhook/reset", async (...[, res]) => {
    await inMemoryContextDAO.resetStorage();
    await mockFacebookClient.reset();
    await mockResponseCapturer.reset();
    res.sendStatus(204);
  });

  router.get("/webhook/get-context", async (...[, res]) => {
    const context = await inMemoryContextDAO.getAllContext();
    res.json(context);
  });

  router.post("/webhook/merge-context", async ({ body }, res) => {
    await inMemoryContextDAO.mergeStorage(body);
    res.sendStatus(204);
  });

  router.post("/webhook/set-context", async ({ body }, res) => {
    await inMemoryContextDAO.overrideStorage(body);
    res.sendStatus(204);
  });

  router.post("/webhook/facebook-client/set-data", async ({ body }, res) => {
    await mockFacebookClient.setData(body);
    res.sendStatus(204);
  });

  router.post("/webhook/:platform", async ({ body }, res, next) => {
    try {
      const { messageProcessor } = await getAsyncDependencies();
      await messageProcessor.receiveRequest({ genericRequest: body });
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  router.get("/webhook/:platform/sent-response", async (...[, res]) => {
    let sentResponses = await mockResponseCapturer.getSentResponses();

    sentResponses = JSON.parse(
      JSON.stringify(sentResponses, (...[, value]) => {
        if (typeof value === "bigint") {
          return value.toString();
        }

        if (value === undefined) {
          return null;
        }

        return value;
      })
    );

    res.json(sentResponses);
  });

  return router;
}
