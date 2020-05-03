import { DynamoDB } from "aws-sdk";
import { requireAllTruthy } from "../common/utils";
import { ContextDAO, AmbiguousPlatform } from "../type";

export function createDynamoDBContextDAO<Context>(
  ddb: DynamoDB,
  tableName: string
): ContextDAO<Context> {
  function getTableKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return {
      targetID: { S: targetID },
      targetPlatform: { S: targetPlatform },
    };
  }

  function getUpdateExpression(context: Partial<Context>) {
    const contextEntries = Object.entries(context);

    const attributes = contextEntries.map(([key, value]) => [
      { [`#${key}`]: key },
      { [`:${key}`]: { S: value } },
    ]);

    return {
      ExpressionAttributeNames: attributes.reduce(
        (acc, [keyAttr]) => ({ ...acc, ...keyAttr }),
        {}
      ),
      ExpressionAttributeValues: attributes.reduce(
        (acc, [, valueAttr]) => ({ ...acc, ...valueAttr }),
        {}
      ),
      UpdateExpression: "SET ".concat(
        contextEntries.map(([key, value]) => `#${key}=:${value}`).join(",")
      ),
    };
  }

  return {
    getContext: (targetID, targetPlatform) =>
      new Promise((resolve, reject) => {
        ddb.getItem(
          {
            Key: getTableKey(targetID, targetPlatform),
            TableName: tableName,
          },
          (err, data) => {
            if (!!err) {
              reject(err);
              return;
            }

            const { Item = {} } = data;

            const resolved = Object.entries(Item).reduce(
              (acc, [key, value]) => ({
                ...acc,
                [key]: Object.values(value)[0],
              }),
              {} as Context
            );

            resolve(resolved);
          }
        );
      }),
    appendContext: (targetID, targetPlatform, context) =>
      new Promise((resolve, reject) => {
        ddb.updateItem(
          {
            Key: getTableKey(targetID, targetPlatform),
            ReturnValues: "NONE",
            TableName: tableName,
            ...getUpdateExpression(context),
          },
          (err, data) => {
            if (!!err) {
              reject(err);
              return;
            }

            resolve(data);
          }
        );
      }),
    resetContext: (targetID, targetPlatform) =>
      new Promise((resolve, reject) => {
        ddb.deleteItem(
          {
            Key: getTableKey(targetID, targetPlatform),
            ReturnValues: "NONE",
            TableName: tableName,
          },
          (err, data) => {
            if (!!err) {
              reject(err);
              return;
            }

            resolve(data);
          }
        );
      }),
  };
}

export default function<Context>() {
  const {
    DYNAMO_DB_ENDPOINT = "",
    DYNAMO_DB_REGION = "",
    DYNAMO_DB_TABLE_NAME = "",
  } = process.env;

  requireAllTruthy({
    DYNAMO_DB_ENDPOINT,
    DYNAMO_DB_REGION,
    DYNAMO_DB_TABLE_NAME,
  });

  const ddb = new DynamoDB({
    apiVersion: "latest",
    endpoint: DYNAMO_DB_ENDPOINT,
    region: DYNAMO_DB_REGION,
  });

  const contextDAO = createDynamoDBContextDAO<Context>(
    ddb,
    DYNAMO_DB_TABLE_NAME
  );
  return { contextDAO, dynamoDBClient: ddb };
}
