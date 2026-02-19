"use client";

import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Dialog } from "./Dialog";
import {
  useUpcomingExpenses,
  useCreateUpcomingExpense,
  useUpdateUpcomingExpense,
  useDeleteUpcomingExpense,
} from "@/lib/hooks/use-upcoming-expenses";
import type { UpcomingExpense } from "@/lib/api/upcoming-expenses";

export function UpcomingExpenses() {
  const { data: expenses = [], isLoading } = useUpcomingExpenses();
  const createMutation = useCreateUpcomingExpense();
  const updateMutation = useUpdateUpcomingExpense();
  const deleteMutation = useDeleteUpcomingExpense();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<UpcomingExpense | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    due_date: new Date(),
  });

  const totalAmount = expenses.reduce((sum, exp) => {
    const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : Number(exp.amount) || 0;
    return sum + amount;
  }, 0);

  const handleAdd = () => {
    setEditingExpense(null);
    setFormData({
      name: "",
      amount: "",
      due_date: new Date(),
    });
    setShowAddDialog(true);
  };

  const handleEdit = (expense: UpcomingExpense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      due_date: new Date(expense.due_date),
    });
    setShowAddDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount) return;

    try {
      if (editingExpense) {
        await updateMutation.mutateAsync({
          expenseId: editingExpense.id,
          data: {
            name: formData.name.trim(),
            amount: parseFloat(formData.amount),
            due_date: formData.due_date.toISOString().split("T")[0],
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: formData.name.trim(),
          amount: parseFloat(formData.amount),
          due_date: formData.due_date.toISOString().split("T")[0],
        });
      }
      setShowAddDialog(false);
      setEditingExpense(null);
      setFormData({
        name: "",
        amount: "",
        due_date: new Date(),
      });
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (confirm("Are you sure you want to delete this upcoming expense?")) {
      try {
        await deleteMutation.mutateAsync(expenseId);
      } catch (error) {
        console.error("Error deleting expense:", error);
      }
    }
  };

  // Sort expenses by due date
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Upcoming Expenses
          </h2>
          <button
            onClick={handleAdd}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Add Expense
          </button>
        </div>

        {isLoading ? (
          <div className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Loading...
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
                -{Number(totalAmount).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                  useGrouping: true,
                })}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Total Upcoming
              </div>
            </div>

            {expenses.length > 0 && (
              <button
                onClick={() => setShowDetailsDialog(true)}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                View Details
              </button>
            )}

            {expenses.length === 0 && (
              <div className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                No upcoming expenses. Click "Add Expense" to add one.
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog
        isOpen={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setEditingExpense(null);
          setFormData({
            name: "",
            amount: "",
            due_date: new Date(),
          });
        }}
        title={editingExpense ? "Edit Upcoming Expense" : "Add Upcoming Expense"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Expense Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Due Date
            </label>
            <DatePicker
              selected={formData.due_date}
              onChange={(date: Date | null) => {
                if (date) setFormData({ ...formData, due_date: date });
              }}
              dateFormat="dd/MM/yyyy"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddDialog(false);
                setEditingExpense(null);
                setFormData({
                  name: "",
                  amount: "",
                  due_date: new Date(),
                });
              }}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingExpense
                ? "Update"
                : "Add"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        title="Upcoming Expenses Details"
        size="lg"
      >
        <div className="space-y-3">
          {sortedExpenses.length > 0 ? (
            sortedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {expense.name}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Due: {new Date(expense.due_date).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-semibold text-red-600 dark:text-red-400">
                      -{Number(expense.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(expense)}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              No upcoming expenses.
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Total:
            </span>
            <span className="text-xl font-bold text-red-600 dark:text-red-400">
              -{Number(totalAmount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setShowDetailsDialog(false)}
            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </Dialog>
    </>
  );
}

