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

  UpdateCommand: class UpdateCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

import { handler } from "../functions/updateExpense/index.mjs";

describe("updateExpense Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = "expense-tracker";
  });

  it("updates an existing expense", async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: "USER#test-user-123",
        SK: "EXPENSE#expense-123",
        expenseId: "expense-123",
        amount: 75.5,
        category: "Shopping",
        description: "Updated expense",
        expenseDate: "2026-08-24",
        updatedAt: "2026-08-24T10:00:00.000Z",
      },
    });

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

      pathParameters: {
        expenseId: "expense-123",
      },

      body: JSON.stringify({
        amount: 75.5,
        category: "Shopping",
        description: "Updated expense",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);

    expect(body).toMatchObject({
      expenseId: "expense-123",
      amount: 75.5,
      category: "Shopping",
      description: "Updated expense",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0][0];

    expect(command.input.TableName).toBe(
      "expense-tracker"
    );

    expect(command.input.Key).toEqual({
      PK: "USER#test-user-123",
      SK: "EXPENSE#expense-123",
    });

    expect(
      command.input.ExpressionAttributeValues[":amount"]
    ).toBe(75.5);

    expect(command.input.ConditionExpression).toBe(
      "attribute_exists(PK) AND attribute_exists(SK)"
    );
  });

  it("returns 401 when the user is not authenticated", async () => {
    const event = {
      requestContext: {},

      pathParameters: {
        expenseId: "expense-123",
      },

      body: JSON.stringify({
        amount: 25,
        category: "Food",
        description: "Test",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(401);

    expect(JSON.parse(response.body)).toEqual({
      message: "Unauthorized",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are invalid", async () => {
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

      pathParameters: {
        expenseId: "expense-123",
      },

      body: JSON.stringify({
        amount: -20,
        category: "Food",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.body)).toEqual({
      message: "Missing or invalid required fields",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense does not exist", async () => {
    const error = new Error("Expense not found");
    error.name = "ConditionalCheckFailedException";

    sendMock.mockRejectedValueOnce(error);

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

      pathParameters: {
        expenseId: "missing-expense",
      },

      body: JSON.stringify({
        amount: 30,
        category: "Food",
        description: "Missing expense",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.body)).toEqual({
      message: "Expense not found",
    });
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

      pathParameters: {
        expenseId: "expense-123",
      },

      body: JSON.stringify({
        amount: 30,
        category: "Food",
        description: "Test",
        expenseDate: "2026-08-24",
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);

    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });
});