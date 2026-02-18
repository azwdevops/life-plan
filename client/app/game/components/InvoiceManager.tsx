"use client";

import { useState } from "react";
import type { Invoice } from "../types";

function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface InvoiceManagerProps {
  invoices: Invoice[];
  currentMonth: number;
  startDate: Date;
  onCreateInvoice: (amount: number, clientName: string, paymentDueMonths: number) => void;
  onDiscountInvoice: (invoiceId: number, discountRate: number) => void;
}

export function InvoiceManager({
  invoices,
  currentMonth,
  startDate,
  onCreateInvoice,
  onDiscountInvoice,
}: InvoiceManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [paymentDueMonths, setPaymentDueMonths] = useState("2");

  const handleCreate = () => {
    const amount = parseFloat(invoiceAmount);
    if (amount > 0 && clientName.trim() && parseInt(paymentDueMonths) > 0) {
      onCreateInvoice(amount, clientName.trim(), parseInt(paymentDueMonths));
      setShowCreateDialog(false);
      setInvoiceAmount("");
      setClientName("");
      setPaymentDueMonths("2");
    }
  };

  const pendingInvoices = invoices.filter((inv) => inv.status === "pending");
  const discountedInvoices = invoices.filter((inv) => inv.status === "discounted");
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Invoices
        </h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
        >
          + Create Invoice
        </button>
      </div>

      {showCreateDialog && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
            Create New Invoice
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Enter client name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                Invoice Amount (KSh)
              </label>
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Enter amount"
                min="0"
                step="100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                Payment Due (Months)
              </label>
              <input
                type="number"
                value={paymentDueMonths}
                onChange={(e) => setPaymentDueMonths(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                min="1"
                max="12"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                Create Invoice
              </button>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
          No invoices yet. Create an invoice to track cashflow.
        </div>
      ) : (
        <div className="space-y-4">
          {pendingInvoices.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Pending Invoices
              </h3>
              <div className="flex flex-wrap gap-2">
                {pendingInvoices.map((invoice) => {
                  const monthsUntilDue = invoice.paymentDueMonth - currentMonth;
                  return (
                    <div
                      key={invoice.id}
                      className="flex-1 min-w-[280px] rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                            {invoice.invoiceNumber}
                          </div>
                          <div className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                            {invoice.clientName}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            KSh {invoice.amount.toLocaleString()}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            Due {formatMonthYear(getDateFromMonth(startDate, invoice.paymentDueMonth))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onDiscountInvoice(invoice.id, 0.10)}
                          className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                          10% - KSh {Math.round(invoice.amount * 0.9).toLocaleString()}
                        </button>
                        <button
                          onClick={() => onDiscountInvoice(invoice.id, 0.15)}
                          className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                        >
                          15% - KSh {Math.round(invoice.amount * 0.85).toLocaleString()}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {discountedInvoices.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Discounted Invoices
              </h3>
              <div className="flex flex-wrap gap-2">
                {discountedInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex-1 min-w-[200px] rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {(invoice.discountRate! * 100).toFixed(0)}% off
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 line-through">
                          KSh {invoice.amount.toLocaleString()}
                        </div>
                        <div className="font-bold text-green-600 dark:text-green-400">
                          KSh {invoice.discountedAmount?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paidInvoices.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Paid Invoices
              </h3>
              <div className="flex flex-wrap gap-2">
                {paidInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex-1 min-w-[200px] rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                          {invoice.invoiceNumber}
                        </div>
                        <div className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {invoice.clientName}
                        </div>
                      </div>
                      <div className="font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                        KSh {invoice.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

