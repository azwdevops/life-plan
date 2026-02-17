"use client";

import { useState } from "react";
import type { Expense, ExpenseCategory } from "../types";
import { useDialogs } from "./CustomDialogs";
import { Dialog } from "@/components/Dialog";

interface ExpensesManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, "id">) => void;
  onUpdateExpense: (id: number, expense: Partial<Expense>) => void;
  onDeleteExpense: (id: number) => void;
}

const expenseCategories: { value: ExpenseCategory; label: string; icon: string; defaultAmount: number; names: string[] }[] = [
  { 
    value: "rent", 
    label: "Rent", 
    icon: "🏠", 
    defaultAmount: 15000,
    names: ["Apartment Rent", "House Rent", "Room Rent", "Office Rent", "Shop Rent"]
  },
  { 
    value: "food", 
    label: "Food & Groceries", 
    icon: "🍔", 
    defaultAmount: 20000,
    names: ["Groceries", "Food Shopping", "Restaurant Meals", "Takeout", "Household Food"]
  },
  { 
    value: "school_fees", 
    label: "School Fees", 
    icon: "📚", 
    defaultAmount: 10000,
    names: ["Primary School Fees", "High School Fees", "University Fees", "Tuition", "School Supplies"]
  },
  { 
    value: "fuel", 
    label: "Fuel & Transport", 
    icon: "⛽", 
    defaultAmount: 8000,
    names: ["Petrol", "Diesel", "Public Transport", "Uber/Taxi", "Vehicle Maintenance"]
  },
  { 
    value: "utilities", 
    label: "Utilities", 
    icon: "💡", 
    defaultAmount: 5000,
    names: ["Electricity", "Water Bill", "Internet", "Phone Bill", "Cable TV"]
  },
  { 
    value: "other", 
    label: "Other", 
    icon: "📋", 
    defaultAmount: 5000,
    names: ["Insurance", "Gym Membership", "Entertainment", "Clothing", "Personal Care", "Subscriptions"]
  },
];

export function ExpensesManager({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpensesManagerProps) {
  const { prompt, alert } = useDialogs();
  const [showDialog, setShowDialog] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [numExpenses, setNumExpenses] = useState("5");
  const [minAmount, setMinAmount] = useState("3000");
  const [maxAmount, setMaxAmount] = useState("30000");

  const totalMonthlyExpenses = expenses
    .filter((exp) => exp.isActive)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const handleAddExpense = async (category: ExpenseCategory) => {
    const categoryInfo = expenseCategories.find((c) => c.value === category);
    const defaultAmount = categoryInfo?.defaultAmount || 5000;

    const nameStr = await prompt(
      `Enter expense name:`,
      "Add Expense",
      categoryInfo?.label || "Expense"
    );
    if (!nameStr) return;

    const amountStr = await prompt(
      `Enter monthly amount (default: KSh ${defaultAmount.toLocaleString()}):`,
      "Add Expense",
      defaultAmount.toString()
    );
    if (!amountStr) return;

    const amount = parseInt(amountStr.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await alert("Invalid amount. Please enter a positive number.", "Invalid Input");
      return;
    }

    onAddExpense({
      category,
      name: nameStr,
      amount,
      isActive: true,
    });
    setShowAddForm(false);
  };

  const handleToggleExpense = (id: number) => {
    const expense = expenses.find((e) => e.id === id);
    if (expense) {
      onUpdateExpense(id, { isActive: !expense.isActive });
    }
  };

  const handleEditExpense = async (expense: Expense) => {
    const amountStr = await prompt(
      `Enter new monthly amount (current: KSh ${expense.amount.toLocaleString()}):`,
      "Edit Expense",
      expense.amount.toString()
    );
    if (!amountStr) return;

    const amount = parseInt(amountStr.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await alert("Invalid amount. Please enter a positive number.", "Invalid Input");
      return;
    }

    onUpdateExpense(expense.id, { amount });
  };

  const handleDeleteExpense = async (id: number) => {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;

    const confirmed = await prompt(
      `Are you sure you want to delete "${expense.name}"?`,
      "Delete Expense",
      "yes"
    );

    if (confirmed?.toLowerCase() === "yes" || confirmed?.toLowerCase() === "y") {
      onDeleteExpense(id);
    }
  };

  const handleGenerateRandomExpenses = () => {
    const num = parseInt(numExpenses, 10);
    const min = parseInt(minAmount.replace(/,/g, ""), 10);
    const max = parseInt(maxAmount.replace(/,/g, ""), 10);

    if (isNaN(num) || num <= 0 || num > 20) {
      alert("Please enter a valid number of expenses (1-20).", "Invalid Input");
      return;
    }

    if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0 || min > max) {
      alert("Please enter valid amount range (min and max must be positive, max >= min).", "Invalid Input");
      return;
    }

    // Generate random expenses
    const generatedExpenses: Omit<Expense, "id">[] = [];
    const usedCategories = new Set<ExpenseCategory>();

    for (let i = 0; i < num; i++) {
      // Prefer categories that haven't been used yet, but allow duplicates if needed
      const availableCategories = expenseCategories.filter(
        (cat) => !usedCategories.has(cat.value) || Math.random() > 0.3
      );
      
      const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
      usedCategories.add(category.value);

      // Get a random name from the category's names
      const name = category.names[Math.floor(Math.random() * category.names.length)];
      
      // Generate random amount within range
      const amount = Math.round(min + Math.random() * (max - min));
      
      generatedExpenses.push({
        category: category.value,
        name,
        amount,
        isActive: true,
      });
    }

    // Add all generated expenses
    generatedExpenses.forEach((expense) => {
      onAddExpense(expense);
    });

    setShowGenerator(false);
    setNumExpenses("5");
    setMinAmount("3000");
    setMaxAmount("30000");
  };

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Monthly Expenses
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Total: KSh {totalMonthlyExpenses.toLocaleString()}/month
            </p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Manage Expenses
          </button>
        </div>
      </div>

      <Dialog
        isOpen={showDialog}
        onClose={() => {
          setShowDialog(false);
          setShowAddForm(false);
        }}
        title="Manage Monthly Expenses"
        size="xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Total Monthly Expenses</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                KSh {totalMonthlyExpenses.toLocaleString()}
              </div>
            </div>
            {!showAddForm && !showGenerator && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGenerator(true)}
                  className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                >
                  🎲 Generate Random
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  + Add Expense
                </button>
              </div>
            )}
          </div>

          {showGenerator && (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">Generate Random Expenses</h3>
                <button
                  onClick={() => {
                    setShowGenerator(false);
                    setNumExpenses("5");
                    setMinAmount("3000");
                    setMaxAmount("30000");
                  }}
                  className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-100"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Number of Expenses (1-20)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numExpenses}
                    onChange={(e) => setNumExpenses(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Min Amount (KSh)
                    </label>
                    <input
                      type="text"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="3000"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Max Amount (KSh)
                    </label>
                    <input
                      type="text"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="30000"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerateRandomExpenses}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                >
                  Generate {numExpenses} Random Expenses
                </button>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Expenses will be generated with realistic names and random amounts between KSh {parseInt(minAmount.replace(/,/g, "")) || 3000} and KSh {parseInt(maxAmount.replace(/,/g, "")) || 30000}
                </p>
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Add New Expense</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-100"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {expenseCategories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => handleAddExpense(category.value)}
                    className="rounded-lg border border-blue-200 bg-white p-3 text-left transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-zinc-800 dark:hover:bg-blue-900/20"
                  >
                    <div className="text-2xl">{category.icon}</div>
                    <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {category.label}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Default: KSh {category.defaultAmount.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-zinc-600 dark:text-zinc-400">No expenses added yet.</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                  Click "Add Expense" to get started.
                </p>
              </div>
            ) : (
              expenses.map((expense) => {
                const categoryInfo = expenseCategories.find((c) => c.value === expense.category);
                return (
                  <div
                    key={expense.id}
                    className={`rounded-lg border p-4 ${
                      expense.isActive
                        ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{categoryInfo?.icon || "📋"}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {expense.name}
                            </h3>
                            {!expense.isActive && (
                              <span className="rounded-full bg-zinc-400 px-2 py-0.5 text-xs text-white">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {categoryInfo?.label || expense.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            KSh {expense.amount.toLocaleString()}/month
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleExpense(expense.id)}
                            className={`rounded px-3 py-1 text-xs font-medium ${
                              expense.isActive
                                ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300"
                                : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300"
                            }`}
                          >
                            {expense.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}

