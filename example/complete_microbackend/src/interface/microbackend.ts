/** This file is auto-generated, please do not modify it manually */
import "@microbackend/common-utils";
import "@microbackend/plugin-core";
import "@microbackend/plugin-env-vars";
import "@microbackend/plugin-express";
import "@microbackend/plugin-hmr";
import "@microbackend/plugin-http";
import "@microbackend/plugin-typescript";
import "@microbackend/plugin-chatbot-engine-express";

export type IServiceExtractor<T> =
  T extends typeof import('@microbackend/plugin-core').MicrobackendService
    ? T['prototype']
    : T extends (...args: any[]) => any
    ? ReturnType<T>
    : never;

declare module "@microbackend/plugin-core" {
  interface IMicrobackendServiceRegistry {}
}