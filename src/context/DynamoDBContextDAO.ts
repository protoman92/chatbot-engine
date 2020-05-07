import { DynamoDB } from "aws-sdk";
import { AttributeMap } from "aws-sdk/clients/dynamodb";
import { requireAllTruthy } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

interface CreateDynamoDBContextDAOConfig {
  readonly dynamoDB: DynamoDB;
  readonly tableName: string;
}

export function createDynamoDBContextDAO<Context>({
  dynamoDB: ddb,
  tableName,
}: CreateDynamoDBContextDAOConfig): ContextDAO<Context> {
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

  function mapAttributeMapToContext(attrMap: AttributeMap) {
    return Object.entries(attrMap).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: Object.values(value)[0],
      }),
      {} as Context
    );
  }

  const contextDAO: ContextDAO<Context> = {
    getContext: async (targetID, targetPlatform) => {
      const { Item = {} } = await ddb
        .getItem({
          Key: getTableKey(targetID, targetPlatform),
          TableName: tableName,
        })
        .promise();

      return mapAttributeMapToContext(Item);
    },
    appendContext: async (targetID, targetPlatform, context) => {
      const oldContext = await contextDAO.getContext(targetID, targetPlatform);

      const { Attributes = {} } = await ddb
        .updateItem({
          Key: getTableKey(targetID, targetPlatform),
          ReturnValues: "NONE",
          TableName: tableName,
          ...getUpdateExpression(context),
        })
        .promise();

      const newContext = mapAttributeMapToContext(Attributes);
      return { newContext, oldContext };
    },
    resetContext: async (targetID, targetPlatform) =>
      ddb
        .deleteItem({
          Key: getTableKey(targetID, targetPlatform),
          ReturnValues: "NONE",
          TableName: tableName,
        })
        .promise(),
  };

  return contextDAO;
}

export default function<Context>() {
  const {
    AWS_ACCESS_KEY_ID = "",
    AWS_SECRET_ACCESS_KEY = "",
    DYNAMO_DB_ENDPOINT = "",
    DYNAMO_DB_REGION = "",
    DYNAMO_DB_TABLE_NAME = "",
  } = process.env;

  requireAllTruthy({
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    DYNAMO_DB_ENDPOINT,
    DYNAMO_DB_REGION,
    DYNAMO_DB_TABLE_NAME,
  });

  const ddb = new DynamoDB({
    apiVersion: "latest",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    endpoint: DYNAMO_DB_ENDPOINT,
    region: DYNAMO_DB_REGION,
  });

  return {
    contextDAO: createDynamoDBContextDAO<Context>({
      dynamoDB: ddb,
      tableName: DYNAMO_DB_TABLE_NAME,
    }),
    dynamoDBClient: ddb,
  };
}
