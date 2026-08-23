import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  try {
    const userId =
      event.requestContext?.authorizer?.jwt?.claims?.sub;

    const expenseId = event.pathParameters?.expenseId;

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body;

    const {
      amount,
      category,
      description,
      expenseDate,
    } = body || {};

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Unauthorized",
        }),
      };
    }

    const numericAmount = Number(amount);

    if (
      !expenseId ||
      amount === undefined ||
      amount === null ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0 ||
      !category ||
      !expenseDate
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing or invalid required fields",
        }),
      };
    }

    const updatedAt = new Date().toISOString();

    const result = await dynamoDB.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,

        Key: {
          PK: `USER#${userId}`,
          SK: `EXPENSE#${expenseId}`,
        },

        UpdateExpression: `
          SET #amount = :amount,
              #category = :category,
              #description = :description,
              #expenseDate = :expenseDate,
              #updatedAt = :updatedAt
        `,

        ExpressionAttributeNames: {
          "#amount": "amount",
          "#category": "category",
          "#description": "description",
          "#expenseDate": "expenseDate",
          "#updatedAt": "updatedAt",
        },

        ExpressionAttributeValues: {
          ":amount": numericAmount,
          ":category": category,
          ":description": description || "",
          ":expenseDate": expenseDate,
          ":updatedAt": updatedAt,
        },

        ConditionExpression:
          "attribute_exists(PK) AND attribute_exists(SK)",

        ReturnValues: "ALL_NEW",
      })
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result.Attributes),
    };
  } catch (error) {
    console.error("Error updating expense:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Expense not found",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};