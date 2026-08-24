import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class DynamoDBClient {
    constructor() {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: sendMock,
    })),
  },

  PutCommand: class PutCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

import { handler } from "../functions/createExpense/index.mjs";

describe("createExpense Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = "expense-tracker";
  });

  it("creates a valid expense", async () => {
    sendMock.mockResolvedValueOnce({});

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },

      body: JSON.stringify({
        amount: 25.5,
        category: "Food",
        description: "Lunch",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);

    expect(body).toMatchObject({
      PK: "USER#test-user-123",
      amount: 25.5,
      category: "Food",
      description: "Lunch",
      expenseDate: "2026-08-24",
    });

    expect(body.expenseId).toBeDefined();

    expect(body.SK).toBe(
      `EXPENSE#${body.expenseId}`
    );

    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command =
      sendMock.mock.calls[0][0];

    expect(command.input.TableName).toBe(
      "expense-tracker"
    );

    expect(command.input.Item).toMatchObject({
      PK: "USER#test-user-123",
      amount: 25.5,
      category: "Food",
      description: "Lunch",
      expenseDate: "2026-08-24",
    });
  });

  it("rejects an invalid amount", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },

      body: JSON.stringify({
        amount: -10,
        category: "Food",
        description: "Invalid test",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.body)).toEqual({
      message:
        "Missing or invalid required fields",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a request without an authenticated user", async () => {
    const event = {
      requestContext: {},

      body: JSON.stringify({
        amount: 20,
        category: "Food",
        description: "Test",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.body)).toEqual({
      message:
        "Missing or invalid required fields",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 500 when DynamoDB fails", async () => {
    sendMock.mockRejectedValueOnce(
      new Error("DynamoDB unavailable")
    );

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },

      body: JSON.stringify({
        amount: 50,
        category: "Shopping",
        description: "Test purchase",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);

    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});