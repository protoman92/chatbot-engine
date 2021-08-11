import express from "express";
import { AmbiguousPlatform } from "../../type";
import { DefaultLeafDependencies } from "../interface";

export default function <Context>({
  getMessengerComponents,
}: DefaultLeafDependencies<Context>) {
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
      const { contextDAO } = await getMessengerComponents();

      const context = await contextDAO.getContext({
        targetID,
        targetPlatform: platform as AmbiguousPlatform,
      });

      res.json(context);
    }
  );

  router.post(
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
      const { contextDAO } = await getMessengerComponents();

      const result = await contextDAO.appendContext({
        targetID,
        context: body,
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
      const { contextDAO } = await getMessengerComponents();

      await contextDAO.resetContext({
        targetID,
        targetPlatform: platform as AmbiguousPlatform,
      });

      res.sendStatus(204);
    }
  );

  return router;
}
