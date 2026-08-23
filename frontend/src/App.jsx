import { useAuth } from "react-oidc-context";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const CATEGORIES = [
  "Food",
  "Transportation",
  "Housing",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Healthcare",
  "Other",
];

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#64748b",
];

function App() {
  const auth = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const [expenses, setExpenses] = useState([]);

  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    description: "",
    expenseDate: "",
  });

  const [editData, setEditData] = useState({
    amount: "",
    category: "",
    description: "",
    expenseDate: "",
  });

  const [editingId, setEditingId] = useState(null);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const loadExpenses = async () => {
    try {
      setLoadingExpenses(true);

      const response = await fetch(`${API_BASE_URL}/expenses`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${auth.user.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to load expenses:", data);
        setMessage(data.message || "Failed to load expenses.");
        setMessageType("error");
        return;
      }

      if (!Array.isArray(data)) {
        console.error("Unexpected GET response:", data);
        setMessage("Unexpected response from server.");
        setMessageType("error");
        return;
      }

      const sortedExpenses = [...data].sort((a, b) => {
        const dateDifference =
          new Date(b.expenseDate) - new Date(a.expenseDate);

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      setExpenses(sortedExpenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
      setMessage("Unable to load expenses.");
      setMessageType("error");
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      loadExpenses();
    }
  }, [auth.isAuthenticated, auth.user?.access_token]);

  const totalSpending = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    );
  }, [expenses]);

  const currentMonthSpending = useMemo(() => {
    const now = new Date();

    return expenses.reduce((total, expense) => {
      if (!expense.expenseDate) {
        return total;
      }

      const expenseDate = new Date(
        `${expense.expenseDate}T00:00:00`
      );

      if (
        expenseDate.getFullYear() === now.getFullYear() &&
        expenseDate.getMonth() === now.getMonth()
      ) {
        return total + Number(expense.amount || 0);
      }

      return total;
    }, 0);
  }, [expenses]);

  const largestExpense = useMemo(() => {
    if (expenses.length === 0) {
      return 0;
    }

    return Math.max(
      ...expenses.map((expense) => Number(expense.amount || 0))
    );
  }, [expenses]);

  const averageExpense = useMemo(() => {
    if (expenses.length === 0) {
      return 0;
    }

    return totalSpending / expenses.length;
  }, [expenses, totalSpending]);

  const categoryData = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      const category = expense.category || "Other";
      const amount = Number(expense.amount || 0);

      totals[category] = (totals[category] || 0) + amount;
    });

    return Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      if (!expense.expenseDate) {
        return;
      }

      const [year, month] = expense.expenseDate.split("-");
      const key = `${year}-${month}`;

      totals[key] =
        (totals[key] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => {
        const [year, month] = key.split("-");

        const label = new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
        }).format(
          new Date(Number(year), Number(month) - 1, 1)
        );

        return {
          month: label,
          amount: Number(amount.toFixed(2)),
        };
      });
  }, [expenses]);

  const topCategory = useMemo(() => {
    if (categoryData.length === 0) {
      return "—";
    }

    return categoryData[0].category;
  }, [categoryData]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const createExpense = async (event) => {
    event.preventDefault();

    if (
      !formData.amount ||
      !formData.category ||
      !formData.expenseDate
    ) {
      setMessage(
        "Amount, category, and date are required."
      );
      setMessageType("error");
      return;
    }

    try {
      setLoadingCreate(true);
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/expenses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            amount: Number(formData.amount),
            category: formData.category,
            description: formData.description,
            expenseDate: formData.expenseDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed to create expense:",
          data
        );

        setMessage(
          data.message || "Failed to create expense."
        );
        setMessageType("error");
        return;
      }

      setFormData({
        amount: "",
        category: "",
        description: "",
        expenseDate: "",
      });

      await loadExpenses();

      setMessage("Expense added successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(
        "Error creating expense:",
        error
      );

      setMessage("Unable to create expense.");
      setMessageType("error");
    } finally {
      setLoadingCreate(false);
    }
  };

  const deleteExpense = async (expenseId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(expenseId);
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/expenses/${expenseId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );

      if (!response.ok) {
        let errorData = {};

        try {
          errorData = await response.json();
        } catch {
          // Successful DELETE normally returns no JSON.
        }

        setMessage(
          errorData.message ||
            "Failed to delete expense."
        );
        setMessageType("error");
        return;
      }

      await loadExpenses();

      setMessage("Expense deleted successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(
        "Error deleting expense:",
        error
      );

      setMessage("Unable to delete expense.");
      setMessageType("error");
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (expense) => {
    setEditingId(expense.expenseId);

    setEditData({
      amount: expense.amount,
      category: expense.category,
      description: expense.description || "",
      expenseDate: expense.expenseDate,
    });

    setMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);

    setEditData({
      amount: "",
      category: "",
      description: "",
      expenseDate: "",
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const updateExpense = async (expenseId) => {
    if (
      !editData.amount ||
      !editData.category ||
      !editData.expenseDate
    ) {
      setMessage(
        "Amount, category, and date are required."
      );
      setMessageType("error");
      return;
    }

    try {
      setUpdatingId(expenseId);
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/expenses/${expenseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            amount: Number(editData.amount),
            category: editData.category,
            description: editData.description,
            expenseDate: editData.expenseDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to update expense."
        );
        setMessageType("error");
        return;
      }

      setEditingId(null);

      setEditData({
        amount: "",
        category: "",
        description: "",
        expenseDate: "",
      });

      await loadExpenses();

      setMessage("Expense updated successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(
        "Error updating expense:",
        error
      );

      setMessage("Unable to update expense.");
      setMessageType("error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="screen-center">
        <div className="loader"></div>
        <p>Loading Expense Tracker...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="screen-center">
        <div className="auth-card">
          <h1>Authentication Error</h1>

          <p>{auth.error.message}</p>

          <button
            className="primary-button"
            onClick={() =>
              auth.signinRedirect()
            }
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            $
          </div>

          <h1>Expense Tracker</h1>

          <p>
            Track your spending and understand where
            your money goes.
          </p>

          <button
            className="primary-button login-button"
            onClick={() =>
              auth.signinRedirect()
            }
          >
            Sign In
          </button>

          <span className="login-security">
            Secured with Amazon Cognito
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            $
          </div>

          <div>
            <h1>Expense Tracker</h1>
            <p>
              Your personal spending dashboard
            </p>
          </div>
        </div>

        <div className="account-area">
          <div className="account-details">
            <span className="account-label">
              Signed in as
            </span>

            <span className="account-email">
              {auth.user?.profile?.email}
            </span>
          </div>

          <button
            className="secondary-button"
            onClick={() =>
              auth.removeUser()
            }
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="summary-grid">
          <article className="summary-card">
            <div className="summary-icon">
              💰
            </div>

            <div>
              <span className="summary-label">
                Total Spending
              </span>

              <strong>
                ${totalSpending.toFixed(2)}
              </strong>
            </div>
          </article>

          <article className="summary-card">
            <div className="summary-icon">
              📅
            </div>

            <div>
              <span className="summary-label">
                This Month
              </span>

              <strong>
                ${currentMonthSpending.toFixed(2)}
              </strong>
            </div>
          </article>

          <article className="summary-card">
            <div className="summary-icon">
              🧾
            </div>

            <div>
              <span className="summary-label">
                Transactions
              </span>

              <strong>
                {expenses.length}
              </strong>
            </div>
          </article>

          <article className="summary-card">
            <div className="summary-icon">
              📈
            </div>

            <div>
              <span className="summary-label">
                Largest Expense
              </span>

              <strong>
                ${largestExpense.toFixed(2)}
              </strong>
            </div>
          </article>
        </section>

        <section className="analytics-highlights">
          <div>
            <span>
              Average transaction
            </span>

            <strong>
              ${averageExpense.toFixed(2)}
            </strong>
          </div>

          <div>
            <span>
              Top spending category
            </span>

            <strong>
              {topCategory}
            </strong>
          </div>
        </section>

        {message && (
          <div
            className={`message ${messageType}`}
          >
            {message}
          </div>
        )}

        <section className="charts-grid">
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Breakdown
                </span>

                <h2>
                  Spending by Category
                </h2>
              </div>
            </div>

            {categoryData.length === 0 ? (
              <div className="chart-empty">
                Add expenses to see category
                analytics.
              </div>
            ) : (
              <div className="chart-body">
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {categoryData.map(
                        (entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={
                              CHART_COLORS[
                                index %
                                  CHART_COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      formatter={(value) => [
                        `$${Number(
                          value
                        ).toFixed(2)}`,
                        "Spent",
                      ]}
                    />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Trend
                </span>

                <h2>
                  Monthly Spending
                </h2>
              </div>
            </div>

            {monthlyData.length === 0 ? (
              <div className="chart-empty">
                Add expenses to see monthly
                trends.
              </div>
            ) : (
              <div className="chart-body">
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <LineChart
                    data={monthlyData}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                    />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        `$${value}`
                      }
                    />

                    <Tooltip
                      formatter={(value) => [
                        `$${Number(
                          value
                        ).toFixed(2)}`,
                        "Spending",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#2563eb",
                      }}
                      activeDot={{
                        r: 6,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </section>

        <section className="panel category-bar-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Comparison
              </span>

              <h2>
                Category Spending Comparison
              </h2>
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="chart-empty">
              No category data available.
            </div>
          ) : (
            <div className="chart-body bar-chart-body">
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <BarChart
                  data={categoryData}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                  />

                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      `$${value}`
                    }
                  />

                  <Tooltip
                    formatter={(value) => [
                      `$${Number(
                        value
                      ).toFixed(2)}`,
                      "Spent",
                    ]}
                  />

                  <Bar
                    dataKey="amount"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="content-grid">
          <article className="panel expense-form-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  New transaction
                </span>

                <h2>
                  Add Expense
                </h2>
              </div>
            </div>

            <form
              className="expense-form"
              onSubmit={createExpense}
            >
              <div className="form-group">
                <label htmlFor="amount">
                  Amount
                </label>

                <div className="money-input">
                  <span>$</span>

                  <input
                    id="amount"
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="category">
                  Category
                </label>

                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select a category
                  </option>

                  {CATEGORIES.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">
                  Description
                </label>

                <input
                  id="description"
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="e.g. Weekly groceries"
                />
              </div>

              <div className="form-group">
                <label htmlFor="expenseDate">
                  Date
                </label>

                <input
                  id="expenseDate"
                  type="date"
                  name="expenseDate"
                  value={formData.expenseDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                className="primary-button full-width"
                type="submit"
                disabled={loadingCreate}
              >
                {loadingCreate
                  ? "Adding Expense..."
                  : "+ Add Expense"}
              </button>
            </form>
          </article>

          <article className="panel transactions-panel">
            <div className="panel-heading transactions-heading">
              <div>
                <span className="eyebrow">
                  Activity
                </span>

                <h2>
                  Recent Expenses
                </h2>
              </div>

              <button
                className="refresh-button"
                onClick={loadExpenses}
                disabled={loadingExpenses}
              >
                {loadingExpenses
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>
            </div>

            {loadingExpenses &&
            expenses.length === 0 ? (
              <div className="empty-state">
                <div className="loader"></div>

                <p>
                  Loading expenses...
                </p>
              </div>
            ) : expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  🧾
                </div>

                <h3>
                  No expenses yet
                </h3>

                <p>
                  Add your first expense using
                  the form.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="expense-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map(
                      (expense) => {
                        const isEditing =
                          editingId ===
                          expense.expenseId;

                        return (
                          <tr
                            key={
                              expense.expenseId
                            }
                          >
                            {isEditing ? (
                              <>
                                <td>
                                  <input
                                    className="table-input"
                                    type="date"
                                    name="expenseDate"
                                    value={
                                      editData.expenseDate
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                  />
                                </td>

                                <td>
                                  <select
                                    className="table-input"
                                    name="category"
                                    value={
                                      editData.category
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                  >
                                    {CATEGORIES.map(
                                      (
                                        category
                                      ) => (
                                        <option
                                          key={
                                            category
                                          }
                                          value={
                                            category
                                          }
                                        >
                                          {
                                            category
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                </td>

                                <td>
                                  <input
                                    className="table-input"
                                    type="text"
                                    name="description"
                                    value={
                                      editData.description
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                  />
                                </td>

                                <td>
                                  <input
                                    className="table-input amount-edit"
                                    type="number"
                                    name="amount"
                                    min="0.01"
                                    step="0.01"
                                    value={
                                      editData.amount
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                  />
                                </td>

                                <td>
                                  <div className="action-buttons">
                                    <button
                                      className="save-button"
                                      onClick={() =>
                                        updateExpense(
                                          expense.expenseId
                                        )
                                      }
                                      disabled={
                                        updatingId ===
                                        expense.expenseId
                                      }
                                    >
                                      {updatingId ===
                                      expense.expenseId
                                        ? "Saving..."
                                        : "Save"}
                                    </button>

                                    <button
                                      className="cancel-button"
                                      onClick={
                                        cancelEditing
                                      }
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <span className="date-value">
                                    {
                                      expense.expenseDate
                                    }
                                  </span>
                                </td>

                                <td>
                                  <span className="category-badge">
                                    {
                                      expense.category
                                    }
                                  </span>
                                </td>

                                <td>
                                  <span className="description-value">
                                    {expense.description ||
                                      "No description"}
                                  </span>
                                </td>

                                <td>
                                  <strong className="amount-value">
                                    $
                                    {Number(
                                      expense.amount ||
                                        0
                                    ).toFixed(2)}
                                  </strong>
                                </td>

                                <td>
                                  <div className="action-buttons">
                                    <button
                                      className="edit-button"
                                      onClick={() =>
                                        startEditing(
                                          expense
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      className="delete-button"
                                      onClick={() =>
                                        deleteExpense(
                                          expense.expenseId
                                        )
                                      }
                                      disabled={
                                        deletingId ===
                                        expense.expenseId
                                      }
                                    >
                                      {deletingId ===
                                      expense.expenseId
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;