import { createExpressApp } from "@microbackend/plugin-express";
import express from "express";
import "./interface/index.ts";

declare module "@microbackend/plugin-core" {
  interface IMicrobackendApp {}

  interface IMicrobackendConfig {}

  interface IMicrobackendRequest {}
}

export default createExpressApp().then((app) => {
  app.get("/", (_req, res) => {
    res.send({ message: "Hello world" });
  });

  app.use(((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);

  const port = process.env["PORT"] || 3000;

  app.listen(port, () => {
    console.log(`Started server at port ${port}.`);
  });
});
