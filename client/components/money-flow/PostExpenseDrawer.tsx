"use client";

import { useState } from "react";
import Link from "next/link";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { RightDrawer } from "@/components/RightDrawer";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  useLedgers,
  useLedgerGroups,
  useCreateLedger,
  useSpendingTypes,
  useCreateSpendingType,
  useCreateLedgerGroup,
  useParentLedgerGroups,
  useLedgerItems,
  useCreateLedgerItem,
} from "@/lib/hooks/use-accounts";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import type { LedgerCreate, LedgerGroupCreate, LedgerItemCreate } from "@/lib/api/accounts";
import type { TransactionItem } from "@/lib/api/transactions";

function formatKsh(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

interface PurchaseLine {
  item_id: number;
  amount: string;
}

/**
 * Global "Post Expense" flow - reachable from any page via the header's
 * "more actions" menu, not just the Expenses page. Encapsulates the whole
 * cluster: the expense form itself plus every nested "create X while
 * picking" drawer it can open (item, expense ledger, asset account, charge
 * ledger, spending category, ledger group).
 */
export function PostExpenseDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: ledgers = [], isLoading: ledgersLoading } = useLedgers();
  const { data: groups = [] } = useLedgerGroups();
  const { data: parentGroups = [] } = useParentLedgerGroups();
  const { data: spendingTypes = [] } = useSpendingTypes();
  const { data: ledgerItems = [] } = useLedgerItems();
  const createTransactionMutation = useCreateTransaction();
  const createLedgerMutation = useCreateLedger();
  const createSpendingTypeMutation = useCreateSpendingType();
  const createLedgerGroupMutation = useCreateLedgerGroup();
  const createLedgerItemMutation = useCreateLedgerItem();

  const expenditureParentGroup = parentGroups.find(
    (parent) => parent.name.toLowerCase() === "expenditure"
  );

  const expenseGroups = expenditureParentGroup
    ? groups.filter(
        (group) => group.parent_ledger_group_id === expenditureParentGroup.id
      )
    : groups.filter((group) => group.category === "expenses");
  const assetGroups = groups.filter(
    (group) =>
      group.category === "bank_accounts" ||
      group.category === "cash_accounts"
  );
  const chargeGroups = groups.filter(
    (group) => group.category === "bank_charges"
  );

  const expenseLedgers = ledgers.filter((ledger) =>
    expenseGroups.some((group) => group.id === ledger.ledger_group_id)
  );
  const assetLedgers = ledgers.filter((ledger) =>
    assetGroups.some((group) => group.id === ledger.ledger_group_id)
  );
  const chargeLedgers = ledgers.filter((ledger) =>
    chargeGroups.some((group) => group.id === ledger.ledger_group_id)
  );
  const expenseItems = ledgerItems.filter((item) =>
    expenseLedgers.some((ledger) => ledger.id === item.ledger_id)
  );
  const itemLedgerNameById = new Map<number, string>();
  ledgerItems.forEach((item) => {
    const ledger = ledgers.find((l) => l.id === item.ledger_id);
    if (ledger) itemLedgerNameById.set(item.id, ledger.name);
  });

  const [showCreateLedgerDialog, setShowCreateLedgerDialog] = useState(false);
  const [showCreateAssetLedgerDialog, setShowCreateAssetLedgerDialog] = useState(false);
  const [showCreateChargeLedgerDialog, setShowCreateChargeLedgerDialog] = useState(false);
  const [showCreateItemDialog, setShowCreateItemDialog] = useState(false);
  const [showSpendingTypeForm, setShowSpendingTypeForm] = useState(false);
  const [showLedgerGroupForm, setShowLedgerGroupForm] = useState(false);
  const [pendingLedgerName, setPendingLedgerName] = useState("");
  const [pendingAssetLedgerName, setPendingAssetLedgerName] = useState("");
  const [pendingChargeLedgerName, setPendingChargeLedgerName] = useState("");
  const [pendingItemName, setPendingItemName] = useState("");
  const [creatingItemForLineIndex, setCreatingItemForLineIndex] = useState<number | null>(null);
  const [pendingLedgerGroupName, setPendingLedgerGroupName] = useState("");
  const [creatingLedgerGroupFromForm, setCreatingLedgerGroupFromForm] = useState<"expense" | "asset" | "charge" | null>(null);
  const [spendingTypeFormData, setSpendingTypeFormData] = useState({
    name: "",
  });
  const [ledgerGroupFormData, setLedgerGroupFormData] = useState<LedgerGroupCreate>({
    name: "",
    parent_ledger_group_id: 0,
    category: "other",
  });
  const [formData, setFormData] = useState({
    transaction_date: new Date(),
    paying_account_id: 0,
    charge_ledger_id: 0,
    charge_amount: "",
    reference: "",
  });
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    { item_id: 0, amount: "" },
  ]);
  const [itemFormData, setItemFormData] = useState<LedgerItemCreate>({
    name: "",
    ledger_id: 0,
  });
  const [ledgerFormData, setLedgerFormData] = useState<LedgerCreate>({
    name: "",
    ledger_group_id: expenseGroups[0]?.id || 0,
    spending_type_id: null,
  });
  const [assetLedgerFormData, setAssetLedgerFormData] = useState<LedgerCreate>({
    name: "",
    ledger_group_id: assetGroups[0]?.id || 0,
    spending_type_id: null,
  });
  const [chargeLedgerFormData, setChargeLedgerFormData] = useState<LedgerCreate>({
    name: "",
    ledger_group_id: chargeGroups[0]?.id || 0,
    spending_type_id: null,
  });
  const [error, setError] = useState<string | null>(null);

  const formatDateForAPI = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleAddPurchaseLine = () => {
    setPurchaseLines([...purchaseLines, { item_id: 0, amount: "" }]);
  };

  const handleRemovePurchaseLine = (index: number) => {
    if (purchaseLines.length > 1) {
      setPurchaseLines(purchaseLines.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePurchaseLine = (
    index: number,
    field: "item_id" | "amount",
    value: number | string
  ) => {
    const updated = [...purchaseLines];
    const line = { ...updated[index] };
    if (field === "item_id") {
      line.item_id = typeof value === "number" ? value : parseInt(value as string);
    } else {
      line.amount = value as string;
    }
    updated[index] = line;
    setPurchaseLines(updated);
  };

  const handlePostExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.paying_account_id) {
      setError("Please select a paying account");
      return;
    }

    if (!formData.transaction_date) {
      setError("Please select a transaction date");
      return;
    }

    for (let i = 0; i < purchaseLines.length; i++) {
      const line = purchaseLines[i];
      if (!line.item_id) {
        setError(`Please select what was bought for row ${i + 1}`);
        return;
      }
      if (!line.amount || parseFloat(line.amount) <= 0) {
        setError(`Please enter a valid amount for row ${i + 1}`);
        return;
      }
    }

    const itemsTotal = purchaseLines.reduce(
      (sum, line) => sum + (parseFloat(line.amount) || 0),
      0
    );
    const chargeAmount = formData.charge_ledger_id && formData.charge_amount
      ? parseFloat(formData.charge_amount)
      : 0;
    const transactionDate = formatDateForAPI(formData.transaction_date);

    if (formData.charge_ledger_id && (!formData.charge_amount || chargeAmount <= 0)) {
      setError("Please enter a valid charge amount");
      return;
    }

    const items: TransactionItem[] = [];

    purchaseLines.forEach((line) => {
      items.push({
        item_id: line.item_id,
        entry_type: "DEBIT",
        amount: parseFloat(line.amount),
      });
    });

    if (formData.charge_ledger_id && chargeAmount > 0) {
      items.push({
        ledger_id: formData.charge_ledger_id,
        entry_type: "DEBIT",
        amount: chargeAmount,
      });
    }

    const totalCreditAmount = itemsTotal + chargeAmount;
    items.push({
      ledger_id: formData.paying_account_id,
      entry_type: "CREDIT",
      amount: totalCreditAmount,
    });

    try {
      await createTransactionMutation.mutateAsync({
        transaction_date: transactionDate,
        reference:
          formData.reference && formData.reference.trim() !== ""
            ? formData.reference.trim()
            : null,
        transaction_type: "MONEY_PAID",
        total_amount: totalCreditAmount,
        items: items,
      });

      setFormData({
        transaction_date: new Date(),
        paying_account_id: 0,
        charge_ledger_id: 0,
        charge_amount: "",
        reference: "",
      });
      setPurchaseLines([{ item_id: 0, amount: "" }]);
      onClose();
      alert("Expense posted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post expense");
    }
  };

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ledgerFormData.name.trim()) {
      setError("Ledger name is required");
      return;
    }

    if (!ledgerFormData.ledger_group_id) {
      setError("Please select a ledger group");
      return;
    }

    try {
      const newLedger = await createLedgerMutation.mutateAsync(ledgerFormData);

      setItemFormData({
        ...itemFormData,
        ledger_id: newLedger.id,
      });

      setLedgerFormData({
        name: "",
        ledger_group_id: expenseGroups[0]?.id || 0,
        spending_type_id: null,
      });
      setShowCreateLedgerDialog(false);
      setPendingLedgerName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ledger");
    }
  };

  const handleCreateNewItem = (searchTerm: string, lineIndex: number) => {
    setPendingItemName(searchTerm);
    setCreatingItemForLineIndex(lineIndex);
    setItemFormData({ name: searchTerm, ledger_id: expenseLedgers[0]?.id || 0 });
    setShowCreateItemDialog(true);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemFormData.name.trim()) {
      setError("Item name is required");
      return;
    }

    if (!itemFormData.ledger_id) {
      setError("Please select which ledger this item posts to");
      return;
    }

    try {
      const newItem = await createLedgerItemMutation.mutateAsync(itemFormData);

      if (creatingItemForLineIndex !== null) {
        handleUpdatePurchaseLine(creatingItemForLineIndex, "item_id", newItem.id);
      }

      setItemFormData({ name: "", ledger_id: 0 });
      setShowCreateItemDialog(false);
      setPendingItemName("");
      setCreatingItemForLineIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    }
  };

  const handleSpendingTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!spendingTypeFormData.name.trim()) {
      setError("Spending category name is required");
      return;
    }

    try {
      const newSpendingType = await createSpendingTypeMutation.mutateAsync({
        name: spendingTypeFormData.name,
      });

      setLedgerFormData({
        ...ledgerFormData,
        spending_type_id: newSpendingType.id,
      });

      setShowSpendingTypeForm(false);
      setSpendingTypeFormData({
        name: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create spending category");
    }
  };

  const handleCreateNewLedger = (searchTerm: string) => {
    setPendingLedgerName(searchTerm);
    setLedgerFormData({
      name: searchTerm,
      ledger_group_id: expenseGroups[0]?.id || 0,
      spending_type_id: null,
    });
    setShowCreateLedgerDialog(true);
  };

  const handleCreateNewAssetLedger = (searchTerm: string) => {
    setPendingAssetLedgerName(searchTerm);
    setAssetLedgerFormData({
      name: searchTerm,
      ledger_group_id: assetGroups[0]?.id || 0,
      spending_type_id: null,
    });
    setShowCreateAssetLedgerDialog(true);
  };

  const handleCreateNewChargeLedger = (searchTerm: string) => {
    setPendingChargeLedgerName(searchTerm);
    setChargeLedgerFormData({
      name: searchTerm,
      ledger_group_id: chargeGroups[0]?.id || 0,
      spending_type_id: null,
    });
    setShowCreateChargeLedgerDialog(true);
  };

  const handleCreateAssetLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetLedgerFormData.name.trim()) {
      setError("Account name is required");
      return;
    }

    if (!assetLedgerFormData.ledger_group_id) {
      setError("Please select an account group");
      return;
    }

    try {
      const newLedger = await createLedgerMutation.mutateAsync(assetLedgerFormData);

      setFormData({
        ...formData,
        paying_account_id: newLedger.id,
      });

      setAssetLedgerFormData({
        name: "",
        ledger_group_id: assetGroups[0]?.id || 0,
        spending_type_id: null,
      });
      setShowCreateAssetLedgerDialog(false);
      setPendingAssetLedgerName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    }
  };

  const handleCreateChargeLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!chargeLedgerFormData.name.trim()) {
      setError("Ledger name is required");
      return;
    }

    if (!chargeLedgerFormData.ledger_group_id) {
      setError("Please select a ledger group");
      return;
    }

    try {
      const newLedger = await createLedgerMutation.mutateAsync(chargeLedgerFormData);

      setFormData({
        ...formData,
        charge_ledger_id: newLedger.id,
      });

      setChargeLedgerFormData({
        name: "",
        ledger_group_id: chargeGroups[0]?.id || 0,
        spending_type_id: null,
      });
      setShowCreateChargeLedgerDialog(false);
      setPendingChargeLedgerName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transaction charges ledger");
    }
  };

  const handleLedgerGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ledgerGroupFormData.name.trim()) {
      setError("Ledger group name is required");
      return;
    }

    if (!ledgerGroupFormData.parent_ledger_group_id) {
      setError("Please select a parent ledger group");
      return;
    }

    try {
      const newLedgerGroup = await createLedgerGroupMutation.mutateAsync(ledgerGroupFormData);

      if (creatingLedgerGroupFromForm === "expense") {
        setLedgerFormData({
          ...ledgerFormData,
          ledger_group_id: newLedgerGroup.id,
        });
      } else if (creatingLedgerGroupFromForm === "asset") {
        setAssetLedgerFormData({
          ...assetLedgerFormData,
          ledger_group_id: newLedgerGroup.id,
        });
      } else if (creatingLedgerGroupFromForm === "charge") {
        setChargeLedgerFormData({
          ...chargeLedgerFormData,
          ledger_group_id: newLedgerGroup.id,
        });
      }

      setShowLedgerGroupForm(false);
      setLedgerGroupFormData({
        name: "",
        parent_ledger_group_id: 0,
        category: "other",
      });
      setPendingLedgerGroupName("");
      setCreatingLedgerGroupFromForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ledger group");
    }
  };

  return (
    <>
      {/* Post Expense Drawer */}
      <RightDrawer
        open={open}
        onClose={() => {
          onClose();
          setError(null);
        }}
        title="Post Expense"
        width="2xl"
      >
        <form onSubmit={handlePostExpense} className="space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Items *
            </label>
            {purchaseLines.map((line, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <SearchableSelect
                      options={expenseItems.map((item) => ({
                        value: item.id,
                        label: item.name,
                        searchText: item.name,
                      }))}
                      value={line.item_id || 0}
                      onChange={(value) => handleUpdatePurchaseLine(index, "item_id", value)}
                      placeholder="What did you buy?"
                      searchPlaceholder="Type to search items..."
                      required
                      allowClear
                      onCreateNew={(searchTerm) => handleCreateNewItem(searchTerm, index)}
                      createNewLabel={(searchTerm) => `Create "${searchTerm}" item`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.amount}
                      onChange={(e) =>
                        handleUpdatePurchaseLine(index, "amount", e.target.value)
                      }
                      required
                      placeholder="0.00"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-32"
                    />
                    {purchaseLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseLine(index)}
                        className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        aria-label="Remove item"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {line.item_id > 0 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Posts to: {itemLedgerNameById.get(line.item_id) ?? "…"}
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPurchaseLine}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add another item
            </button>
            {expenseItems.length === 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No items yet - type a name above (e.g. &quot;Tea Leaves&quot;) and choose &quot;Create&quot; to add one.
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2.5 dark:bg-zinc-800/50">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Items total</span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {formatKsh(
                  purchaseLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0)
                )}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Transaction Date *
              </label>
              <DatePicker
                selected={formData.transaction_date instanceof Date ? formData.transaction_date : new Date(formData.transaction_date)}
                onChange={(date: Date | null) => {
                  if (date) {
                    setFormData({
                      ...formData,
                      transaction_date: date,
                    });
                  }
                }}
                dateFormat="dd/MM/yyyy"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                required
                popperPlacement="bottom-start"
                popperClassName="react-datepicker-popper-no-backdrop"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Narration (optional)
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reference: e.target.value,
                  })
                }
                placeholder="What is this expense about?"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Paying Account *
              </label>
              <SearchableSelect
                options={assetLedgers.map((ledger) => ({
                  value: ledger.id,
                  label: ledger.name,
                  searchText: ledger.name,
                }))}
                value={formData.paying_account_id || 0}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    paying_account_id:
                      typeof value === "number" ? value : parseInt(value as string),
                  })
                }
                placeholder="Select paying account"
                searchPlaceholder="Type to search accounts..."
                required
                className="w-full"
                allowClear
                onCreateNew={handleCreateNewAssetLedger}
                createNewLabel={(searchTerm) => `Create "${searchTerm}" account`}
              />
              {assetLedgers.length === 0 && !ledgersLoading && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  No asset accounts found. Create one in{" "}
                  <Link
                    href="/accounts"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Accounts
                  </Link>
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Transaction Charges Ledger (Optional)
              </label>
              <SearchableSelect
                options={chargeLedgers.map((ledger) => ({
                  value: ledger.id,
                  label: ledger.name,
                  searchText: ledger.name,
                }))}
                value={formData.charge_ledger_id || 0}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    charge_ledger_id:
                      typeof value === "number" ? value : parseInt(value as string),
                    charge_amount: typeof value === "number" && value === 0 ? "" : formData.charge_amount,
                  })
                }
                placeholder="Select transaction charges ledger (optional)"
                searchPlaceholder="Type to search transaction charges ledgers..."
                className="w-full"
                allowClear
                onCreateNew={handleCreateNewChargeLedger}
                createNewLabel={(searchTerm) => `Create "${searchTerm}" transaction charges ledger`}
              />
            </div>

            {formData.charge_ledger_id > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Transaction Charges Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.charge_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, charge_amount: e.target.value })
                  }
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Total to post
            </span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatKsh(
                purchaseLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0) +
                  (formData.charge_ledger_id ? parseFloat(formData.charge_amount) || 0 : 0)
              )}
            </span>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                setError(null);
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTransactionMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createTransactionMutation.isPending ? "Posting..." : "Post Expense"}
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Item Drawer */}
      <RightDrawer
        open={showCreateItemDialog}
        onClose={() => {
          setShowCreateItemDialog(false);
          setError(null);
          setPendingItemName("");
          setCreatingItemForLineIndex(null);
        }}
        title="Create Item"
        width="md"
        stackLevel={1}
      >
        <form onSubmit={handleCreateItem} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Item Name *
            </label>
            <input
              type="text"
              value={itemFormData.name}
              onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Tea Leaves, Sugar, Cloud Subscription"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Posts to Ledger *
            </label>
            <SearchableSelect
              options={expenseLedgers.map((ledger) => ({
                value: ledger.id,
                label: ledger.name,
                searchText: ledger.name,
              }))}
              value={itemFormData.ledger_id || 0}
              onChange={(value) =>
                setItemFormData({
                  ...itemFormData,
                  ledger_id: typeof value === "number" ? value : parseInt(value as string),
                })
              }
              placeholder="Select which ledger this item posts to"
              searchPlaceholder="Type to search ledgers..."
              required
              className="w-full"
              onCreateNew={handleCreateNewLedger}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" expense ledger`}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              You can change this later - every past transaction for this item will move with it.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateItemDialog(false);
                setError(null);
                setPendingItemName("");
                setCreatingItemForLineIndex(null);
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerItemMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerItemMutation.isPending ? "Creating..." : "Create Item"}
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Ledger Drawer */}
      <RightDrawer
        open={showCreateLedgerDialog}
        onClose={() => {
          setShowCreateLedgerDialog(false);
          setError(null);
          setPendingLedgerName("");
        }}
        title="Create Expense Ledger"
        width="md"
        stackLevel={2}
      >
        <form onSubmit={handleCreateLedger} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Name *
            </label>
            <input
              type="text"
              value={ledgerFormData.name}
              onChange={(e) =>
                setLedgerFormData({ ...ledgerFormData, name: e.target.value })
              }
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Office Supplies, Travel Expenses"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Group *
            </label>
            <SearchableSelect
              options={expenseGroups.map((group) => ({
                value: group.id,
                label: group.name,
                searchText: group.parent_ledger_group
                  ? `${group.name} ${group.parent_ledger_group.name}`
                  : group.name,
              }))}
              value={ledgerFormData.ledger_group_id || 0}
              onChange={(value) =>
                setLedgerFormData({
                  ...ledgerFormData,
                  ledger_group_id:
                    typeof value === "number" ? value : parseInt(value as string),
                })
              }
              placeholder="Select a ledger group"
              searchPlaceholder="Type to search ledger groups..."
              required
              className="w-full"
              onCreateNew={(searchTerm) => {
                setPendingLedgerGroupName(searchTerm);
                setCreatingLedgerGroupFromForm("expense");
                setLedgerGroupFormData({
                  name: searchTerm,
                  parent_ledger_group_id: 0,
                  category: "expenses",
                });
                setShowLedgerGroupForm(true);
              }}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" ledger group`}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Spending Category *
            </label>
            <SearchableSelect
              options={spendingTypes.map((type) => ({
                value: type.id,
                label: type.name,
                searchText: type.name,
              }))}
              value={ledgerFormData.spending_type_id || 0}
              onChange={(value) =>
                setLedgerFormData({
                  ...ledgerFormData,
                  spending_type_id:
                    typeof value === "number" && value !== 0
                      ? value
                      : typeof value === "string" && value !== "0"
                      ? parseInt(value)
                      : null,
                })
              }
              placeholder="Select spending category"
              searchPlaceholder="Type to search spending categories..."
              required
              className="w-full"
              onCreateNew={(searchTerm) => {
                setSpendingTypeFormData({ name: searchTerm });
                setShowSpendingTypeForm(true);
              }}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" spending category`}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateLedgerDialog(false);
                setError(null);
                setPendingLedgerName("");
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerMutation.isPending ? "Creating..." : "Create Ledger"}
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Asset Ledger Drawer */}
      <RightDrawer
        open={showCreateAssetLedgerDialog}
        onClose={() => {
          setShowCreateAssetLedgerDialog(false);
          setError(null);
          setPendingAssetLedgerName("");
        }}
        title="Create Account"
        width="md"
        stackLevel={1}
      >
        <form onSubmit={handleCreateAssetLedger} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Account Name *
            </label>
            <input
              type="text"
              value={assetLedgerFormData.name}
              onChange={(e) =>
                setAssetLedgerFormData({ ...assetLedgerFormData, name: e.target.value })
              }
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Equity Bank, M-Pesa, Cash"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Account Group *
            </label>
            <SearchableSelect
              options={assetGroups.map((group) => ({
                value: group.id,
                label: group.name,
                searchText: group.parent_ledger_group
                  ? `${group.name} ${group.parent_ledger_group.name}`
                  : group.name,
              }))}
              value={assetLedgerFormData.ledger_group_id || 0}
              onChange={(value) =>
                setAssetLedgerFormData({
                  ...assetLedgerFormData,
                  ledger_group_id:
                    typeof value === "number" ? value : parseInt(value as string),
                })
              }
              placeholder="Select an account group"
              searchPlaceholder="Type to search account groups..."
              required
              className="w-full"
              onCreateNew={(searchTerm) => {
                setPendingLedgerGroupName(searchTerm);
                setCreatingLedgerGroupFromForm("asset");
                setLedgerGroupFormData({
                  name: searchTerm,
                  parent_ledger_group_id: 0,
                  category: "bank_accounts",
                });
                setShowLedgerGroupForm(true);
              }}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" ledger group`}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateAssetLedgerDialog(false);
                setError(null);
                setPendingAssetLedgerName("");
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerMutation.isPending ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Spending Category Drawer */}
      <RightDrawer
        open={showSpendingTypeForm}
        onClose={() => setShowSpendingTypeForm(false)}
        title="Create Spending Category"
        width="sm"
        stackLevel={3}
      >
        <form onSubmit={handleSpendingTypeSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name *
            </label>
            <input
              type="text"
              value={spendingTypeFormData.name}
              onChange={(e) =>
                setSpendingTypeFormData({
                  ...spendingTypeFormData,
                  name: e.target.value,
                })
              }
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Food, Transport"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createSpendingTypeMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createSpendingTypeMutation.isPending
                ? "Creating..."
                : "Create Spending Category"}
            </button>
            <button
              type="button"
              onClick={() => setShowSpendingTypeForm(false)}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Charge Ledger Drawer */}
      <RightDrawer
        open={showCreateChargeLedgerDialog}
        onClose={() => {
          setShowCreateChargeLedgerDialog(false);
          setError(null);
          setPendingChargeLedgerName("");
        }}
        title="Create Transaction Charges Ledger"
        width="md"
        stackLevel={1}
      >
        <form onSubmit={handleCreateChargeLedger} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Name *
            </label>
            <input
              type="text"
              value={chargeLedgerFormData.name}
              onChange={(e) =>
                setChargeLedgerFormData({ ...chargeLedgerFormData, name: e.target.value })
              }
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Bank Charges, Transaction Fees"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Group *
            </label>
            <SearchableSelect
              options={chargeGroups.map((group) => ({
                value: group.id,
                label: group.name,
                searchText: group.parent_ledger_group
                  ? `${group.name} ${group.parent_ledger_group.name}`
                  : group.name,
              }))}
              value={chargeLedgerFormData.ledger_group_id || 0}
              onChange={(value) =>
                setChargeLedgerFormData({
                  ...chargeLedgerFormData,
                  ledger_group_id:
                    typeof value === "number" ? value : parseInt(value as string),
                })
              }
              placeholder="Select a ledger group"
              searchPlaceholder="Type to search ledger groups..."
              required
              className="w-full"
              onCreateNew={(searchTerm) => {
                setPendingLedgerGroupName(searchTerm);
                setCreatingLedgerGroupFromForm("charge");
                setLedgerGroupFormData({
                  name: searchTerm,
                  parent_ledger_group_id: 0,
                  category: "bank_charges",
                });
                setShowLedgerGroupForm(true);
              }}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" ledger group`}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateChargeLedgerDialog(false);
                setError(null);
                setPendingChargeLedgerName("");
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerMutation.isPending ? "Creating..." : "Create Ledger"}
            </button>
          </div>
        </form>
      </RightDrawer>

      {/* Create Ledger Group Drawer - opened from the Create Ledger (expense
          item) drawer at stackLevel 2, or from the Asset/Charge ledger
          drawers at stackLevel 1, so its own level must sit one above
          whichever of those triggered it. */}
      <RightDrawer
        open={showLedgerGroupForm}
        onClose={() => {
          setShowLedgerGroupForm(false);
          setLedgerGroupFormData({
            name: "",
            parent_ledger_group_id: 0,
            category: "other",
          });
          setPendingLedgerGroupName("");
          setCreatingLedgerGroupFromForm(null);
        }}
        title="Create Ledger Group"
        width="lg"
        stackLevel={creatingLedgerGroupFromForm === "expense" ? 3 : 2}
      >
        <form onSubmit={handleLedgerGroupSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name *
              </label>
              <input
                type="text"
                value={ledgerGroupFormData.name}
                onChange={(e) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    name: e.target.value,
                  })
                }
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g., Bank Accounts, Cash Accounts"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Parent Ledger Group *
              </label>
              <SearchableSelect
                options={parentGroups.map((group) => ({
                  value: group.id,
                  label: group.name,
                  searchText: group.name,
                }))}
                value={ledgerGroupFormData.parent_ledger_group_id || 0}
                onChange={(value) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    parent_ledger_group_id: typeof value === "number" ? value : parseInt(value as string),
                  })
                }
                placeholder="Select a parent ledger group"
                searchPlaceholder="Type to search parent groups..."
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Category *
              </label>
              <select
                value={ledgerGroupFormData.category}
                onChange={(e) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    category: e.target.value as LedgerGroupCreate["category"],
                  })
                }
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="incomes">Incomes</option>
                <option value="expenses">Expenses</option>
                <option value="bank_accounts">Bank Accounts</option>
                <option value="cash_accounts">Cash Accounts</option>
                <option value="bank_charges">Bank Charges</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowLedgerGroupForm(false);
                setLedgerGroupFormData({
                  name: "",
                  parent_ledger_group_id: 0,
                  category: "other",
                });
                setPendingLedgerGroupName("");
                setCreatingLedgerGroupFromForm(null);
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerGroupMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerGroupMutation.isPending ? "Creating..." : "Create Ledger Group"}
            </button>
          </div>
        </form>
      </RightDrawer>
    </>
  );
}
