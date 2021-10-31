import { AmbiguousPlatform } from "@haipham/chatbot-engine-core";
import express from "express";
import { DefaultLeafDependencies } from "../interface";

export default function <
  Context,
  LeafDependencies extends DefaultLeafDependencies<Context>
>({ contextDAO }: LeafDependencies) {
  const router = express.Router();

  router.get(
    "/context/:platform/:id",
    async (
      ...[
        {
          params: { id: targetID, platform },
        },
        res,
      ]
    ) => {
      const context = await contextDAO.getContext({
        targetID,
        targetPlatform: platform as AmbiguousPlatform,
      });

      res.json(context);
    }
  );

  router.patch(
    "/context/:platform/:id",
    async (
      ...[
        {
          body,
          params: { id: targetID, platform },
        },
        res,
      ]
    ) => {
      const result = await contextDAO.appendContext({
        targetID,
        additionalContext: body,
        targetPlatform: platform as AmbiguousPlatform,
      });

      res.json(result);
    }
  );

  router.delete(
    "/context/:platform/:id",
    async (
      ...[
        {
          params: { id: targetID, platform },
        },
        res,
      ]
    ) => {
      await contextDAO.resetContext({
        targetID,
        targetPlatform: platform as AmbiguousPlatform,
      });

      res.sendStatus(204);
    }
  );

  return router;
}
