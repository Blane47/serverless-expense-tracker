import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  try {
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

    const userId =
      event.requestContext?.authorizer?.jwt?.claims?.sub;

    const numericAmount = Number(amount);

    if (
      !userId ||
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

    const expenseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const item = {
      PK: `USER#${userId}`,
      SK: `EXPENSE#${expenseId}`,
      expenseId,
      amount: numericAmount,
      category,
      description: description || "",
      expenseDate,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: item,
      })
    );

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error("Error creating expense:", error);

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