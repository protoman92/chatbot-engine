import express from "express";
import { inMemoryContextDAO } from "../../../context/InMemoryContextDAO";
import { DefaultLeafDependencies } from "../../interface";
import { mockFacebookClient } from "../client/facebook_client";
import { mockResponseCapturer } from "../middleware/capture_generic_response";

export default function <Context>({
  getMessengerComponents,
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

  router.post("/webhook/set-context", async ({ body }, res) => {
    await inMemoryContextDAO.overrideStorage(body);
    res.sendStatus(204);
  });

  router.post("/webhook/facebook-client/set-data", async ({ body }, res) => {
    await mockFacebookClient.setData(body);
    res.sendStatus(204);
  });

  router.post("/webhook/:platform", async ({ body }, res) => {
    const { messageProcessor } = await getMessengerComponents();
    await messageProcessor.receiveRequest(body);
    res.sendStatus(204);
  });

  router.get("/webhook/:platform/sent-response", async (...[, res]) => {
    const sentResponses = await mockResponseCapturer.getSentResponses();
    res.json(sentResponses);
  });

  return router;
}
