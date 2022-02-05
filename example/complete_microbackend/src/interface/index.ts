import "./microbackend.ts";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly TELEGRAM_AUTH_TOKEN: string;
    }
  }
}
