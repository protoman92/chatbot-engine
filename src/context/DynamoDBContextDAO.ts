import { DynamoDB } from "aws-sdk";
import { requireAllTruthy } from "common/utils";
import { ContextDAO, SupportedPlatform } from "../type";

export function createDynamoDBContextDAO<C>(
  ddb: DynamoDB,
  tableName: string,
  platform: SupportedPlatform
): ContextDAO<C> {
  function getCacheKey(targetID: string) {
    return `${platform}-${targetID}`;
  }

  function getTableKey(targetID: string) {
    return {
      platform: { S: platform },
      targetID: { S: getCacheKey(targetID) }
    };
  }

  function getUpdateExpression(context: Partial<C>) {
    const contextEntries = Object.entries(context);

    const attributes = contextEntries.map(([key, value]) => [
      { [`#${key}`]: key },
      { [`:${key}`]: value }
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
      )
    };
  }

  return {
    getContext: targetID =>
      new Promise((resolve, reject) => {
        ddb.getItem(
          {
            Key: getTableKey(targetID),
            TableName: tableName
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
                [key]: Object.values(value)[0]
              }),
              {} as C
            );

            resolve(resolved);
          }
        );
      }),
    appendContext: (targetID, context) =>
      new Promise((resolve, reject) => {
        ddb.updateItem(
          {
            Key: getTableKey(targetID),
            ReturnValues: "NONE",
            TableName: tableName,
            ...getUpdateExpression(context)
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
    resetContext: targetID =>
      new Promise((resolve, reject) => {
        ddb.deleteItem(
          {
            Key: getTableKey(targetID),
            ReturnValues: "NONE",
            TableName: tableName
          },
          (err, data) => {
            if (!!err) {
              reject(err);
              return;
            }

            resolve(data);
          }
        );
      })
  };
}

export default function() {
  return (tableName: string, platform: SupportedPlatform) => {
    const { DYNAMO_DB_ENDPOINT: dynamoDBEndpoint } = process.env;
    requireAllTruthy({ dynamoDBEndpoint });

    const ddb = new DynamoDB({
      apiVersion: "latest",
      endpoint: dynamoDBEndpoint
    });

    return createDynamoDBContextDAO(ddb, tableName, platform);
  };
}
