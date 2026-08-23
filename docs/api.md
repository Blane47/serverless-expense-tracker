## POST /expenses

**Purpose:**
Create a new expense for the currently logged-in user.

**Authentication required:**
Yes. The user must provide a valid Cognito JWT.

**Request body:**

```json
{
  "amount": 65.25,
  "category": "Groceries",
  "description": "Weekly groceries",
  "expenseDate": "2026-08-22"
}
```

**Successful response:**
`201 Created`

```json
{
  "expenseId": "abc-123",
  "amount": 65.25,
  "category": "Groceries",
  "description": "Weekly groceries",
  "expenseDate": "2026-08-22"
}
```

**Possible errors:**

* `400 Bad Request` — the request body contains missing or invalid fields.
* `401 Unauthorized` — the user is not authenticated or the token is invalid.
* `500 Internal Server Error` — an unexpected backend error occurred.

---

## GET /expenses

**Purpose:**
Return all expenses belonging to the currently logged-in user.

**Authentication required:**
Yes. The user must provide a valid Cognito JWT.

**Request body:**
None.

**Successful response:**
`200 OK`

```json
[
  {
    "expenseId": "abc-123",
    "amount": 65.25,
    "category": "Groceries",
    "description": "Weekly groceries",
    "expenseDate": "2026-08-22"
  }
]
```

**Possible errors:**

* `401 Unauthorized` — the user is not authenticated or the token is invalid.
* `500 Internal Server Error` — an unexpected backend error occurred.

---

## GET /expenses/{expenseId}

**Purpose:**
Return one specific expense belonging to the currently logged-in user.

**Authentication required:**
Yes. The user must provide a valid Cognito JWT.

**Request body:**
None.

**Successful response:**
`200 OK`

```json
{
  "expenseId": "abc-123",
  "amount": 65.25,
  "category": "Groceries",
  "description": "Weekly groceries",
  "expenseDate": "2026-08-22",
  "createdAt": "2026-08-22T17:30:00Z",
  "updatedAt": "2026-08-22T17:30:00Z"
}
```

**Possible errors:**

* `401 Unauthorized` — the user is not authenticated or the token is invalid.
* `404 Not Found` — the expense does not exist or does not belong to the logged-in user.
* `500 Internal Server Error` — an unexpected backend error occurred.

---

## PUT /expenses/{expenseId}

**Purpose:**
Update an existing expense belonging to the currently logged-in user.

**Authentication required:**
Yes. The user must provide a valid Cognito JWT.

**Request body:**

```json
{
  "amount": 72.50,
  "category": "Groceries",
  "description": "Weekly groceries and household supplies",
  "expenseDate": "2026-08-22"
}
```

**Successful response:**
`200 OK`

```json
{
  "expenseId": "abc-123",
  "amount": 72.50,
  "category": "Groceries",
  "description": "Weekly groceries and household supplies",
  "expenseDate": "2026-08-22",
  "createdAt": "2026-08-22T17:30:00Z",
  "updatedAt": "2026-08-22T18:15:00Z"
}
```

**Possible errors:**

* `400 Bad Request` — the request body contains missing or invalid fields.
* `401 Unauthorized` — the user is not authenticated or the token is invalid.
* `404 Not Found` — the expense does not exist or does not belong to the logged-in user.
* `500 Internal Server Error` — an unexpected backend error occurred.

---

## DELETE /expenses/{expenseId}

**Purpose:**
Delete a specific expense belonging to the currently logged-in user.

**Authentication required:**
Yes. The user must provide a valid Cognito JWT.

**Request body:**
None.

**Successful response:**
`204 No Content`

No response body is returned.

**Possible errors:**

* `401 Unauthorized` — the user is not authenticated or the token is invalid.
* `404 Not Found` — the expense does not exist or does not belong to the logged-in user.
* `500 Internal Server Error` — an unexpected backend error occurred.
