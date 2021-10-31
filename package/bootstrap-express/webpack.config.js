const path = require("path");

/**
 * @typedef Args
 * @property {string} env
 * @param {Args} args
 * @returns {Pick<import('webpack').Configuration, 'resolve'>}
 */
module.exports = function ({ env }) {
  return {
    resolve: {
      alias: {
        ...(env === "test"
          ? {
              "./DynamoDBContextDAO": path.join(
                __dirname,
                "..",
                "core",
                "src",
                "context",
                "InMemoryContextDAO"
              ),
              "./RedisContextDAO": path.join(
                __dirname,
                "..",
                "core",
                "src",
                "context",
                "InMemoryContextDAO"
              ),
              "./facebook-client": path.join(
                __dirname,
                "src",
                "test",
                "client",
                "facebook_client"
              ),
              "./telegram-client": path.join(
                __dirname,
                "src",
                "test",
                "client",
                "telegram_client"
              ),
              "./middleware/capture_generic_response": path.join(
                __dirname,
                "src",
                "test",
                "middleware",
                "capture_generic_response"
              ),
              "./route/bootstrap_webhook_route": path.join(
                __dirname,
                "src",
                "test",
                "route",
                "bootstrap_webhook_route"
              ),
            }
          : {}),
      },
    },
  };
};
