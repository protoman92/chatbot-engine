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
              "./facebook-client": path.join(
                __dirname,
                "test",
                "client",
                "facebook_client"
              ),
              "./telegram-client": path.join(
                __dirname,
                "test",
                "client",
                "facebook_client"
              ),
              "./middleware/capture_generic_response": path.join(
                __dirname,
                "test",
                "middleware",
                "capture_generic_response"
              ),
            }
          : {}),
      },
    },
  };
};
