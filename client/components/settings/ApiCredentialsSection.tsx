"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import {
  createApiKey,
  createApiProvider,
  createApiProviderModel,
  deleteApiKey,
  deleteApiProvider,
  deleteApiProviderModel,
  listApiProviders,
  updateApiKey,
  updateApiProvider,
  updateApiProviderModel,
  type ApiKeyMasked,
  type ApiProviderModelOut,
  type ApiProviderOut,
} from "@/lib/api/user-api-credentials";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, day] = iso.split("T")[0]!.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function ymdStringToDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const [y, m, day] = t.split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const expiryDatePickerClassName =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500";

const expiryDatePickerClassNameLg =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500";

type EditKeyState = {
  providerId: number;
  key: ApiKeyMasked;
};

type EditModelState = {
  providerId: number;
  model: ApiProviderModelOut;
};

type Props = {
  token: string;
};

export type ApiCredentialsSectionHandle = {
  openAddProvider: () => void;
};

export const ApiCredentialsSection = forwardRef<ApiCredentialsSectionHandle, Props>(
  function ApiCredentialsSection({ token }, ref) {
  const [providers, setProviders] = useState<ApiProviderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProviderName, setNewProviderName] = useState("");
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [addProviderSaving, setAddProviderSaving] = useState(false);
  const [editProvider, setEditProvider] = useState<ApiProviderOut | null>(null);
  const [providerEditName, setProviderEditName] = useState("");
  const [providerEditSaving, setProviderEditSaving] = useState(false);
  const [keysDialogProviderId, setKeysDialogProviderId] = useState<number | null>(null);
  const [modelsDialogProviderId, setModelsDialogProviderId] = useState<number | null>(null);
  const [keyForms, setKeyForms] = useState<
    Record<number, { name: string; value: string; expires: string }>
  >({});
  const [modelForms, setModelForms] = useState<Record<number, { name: string; slug: string }>>({});
  const [editKey, setEditKey] = useState<EditKeyState | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editModel, setEditModel] = useState<EditModelState | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editModelSlug, setEditModelSlug] = useState("");
  const [editModelSaving, setEditModelSaving] = useState(false);

  const keysDialogProvider =
    keysDialogProviderId != null
      ? providers.find((p) => p.id === keysDialogProviderId) ?? null
      : null;

  const modelsDialogProvider =
    modelsDialogProviderId != null
      ? providers.find((p) => p.id === modelsDialogProviderId) ?? null
      : null;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await listApiProviders(token);
      setProviders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load API credentials");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (keysDialogProviderId == null) return;
    if (!loading && !providers.some((p) => p.id === keysDialogProviderId)) {
      setKeysDialogProviderId(null);
    }
  }, [keysDialogProviderId, providers, loading]);

  useEffect(() => {
    if (modelsDialogProviderId == null) return;
    if (!loading && !providers.some((p) => p.id === modelsDialogProviderId)) {
      setModelsDialogProviderId(null);
    }
  }, [modelsDialogProviderId, providers, loading]);

  const getKeyForm = (providerId: number) =>
    keyForms[providerId] ?? { name: "", value: "", expires: "" };

  const setKeyForm = (
    providerId: number,
    partial: Partial<{ name: string; value: string; expires: string }>
  ) => {
    setKeyForms((prev) => ({
      ...prev,
      [providerId]: { ...getKeyForm(providerId), ...partial },
    }));
  };

  const getModelForm = (providerId: number) =>
    modelForms[providerId] ?? { name: "", slug: "" };

  const setModelForm = (
    providerId: number,
    partial: Partial<{ name: string; slug: string }>
  ) => {
    setModelForms((prev) => ({
      ...prev,
      [providerId]: { ...getModelForm(providerId), ...partial },
    }));
  };

  useImperativeHandle(ref, () => ({
    openAddProvider: () => {
      setError(null);
      setNewProviderName("");
      setAddProviderOpen(true);
    },
  }));

  const closeAddProviderDialog = () => {
    setAddProviderOpen(false);
    setNewProviderName("");
  };

  const handleAddProvider = async () => {
    const name = newProviderName.trim();
    if (!name) return;
    setAddProviderSaving(true);
    setError(null);
    try {
      await createApiProvider(token, name);
      closeAddProviderDialog();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add provider");
    } finally {
      setAddProviderSaving(false);
    }
  };

  const openEditProvider = (p: ApiProviderOut) => {
    setEditProvider(p);
    setProviderEditName(p.name);
  };

  const closeEditProvider = () => {
    setEditProvider(null);
    setProviderEditName("");
    setProviderEditSaving(false);
  };

  const handleSaveEditProvider = async () => {
    if (!editProvider) return;
    const name = providerEditName.trim();
    if (!name) return;
    setProviderEditSaving(true);
    setError(null);
    try {
      await updateApiProvider(token, editProvider.id, name);
      closeEditProvider();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update provider");
    } finally {
      setProviderEditSaving(false);
    }
  };

  const handleDeleteProvider = async (providerId: number) => {
    if (!window.confirm("Delete this provider, all API keys, and all models?")) return;
    setError(null);
    try {
      await deleteApiProvider(token, providerId);
      if (keysDialogProviderId === providerId) setKeysDialogProviderId(null);
      if (modelsDialogProviderId === providerId) setModelsDialogProviderId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete provider");
    }
  };

  const handleAddKey = async (providerId: number) => {
    const f = getKeyForm(providerId);
    const name = f.name.trim();
    const value = f.value.trim();
    if (!name || !value) return;
    setError(null);
    try {
      const body: { name: string; value: string; expires_on?: string | null } = {
        name,
        value,
      };
      if (f.expires.trim()) {
        body.expires_on = f.expires.trim();
      }
      await createApiKey(token, providerId, body);
      setKeyForm(providerId, { name: "", value: "", expires: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add key");
    }
  };

  const openEditKey = (providerId: number, key: ApiKeyMasked) => {
    setEditKey({ providerId, key });
    setEditName(key.name);
    setEditValue("");
    setEditExpires(key.expires_on ? key.expires_on.split("T")[0]! : "");
  };

  const closeEditKey = () => {
    setEditKey(null);
    setEditSaving(false);
  };

  const handleSaveEditKey = async () => {
    if (!editKey) return;
    const name = editName.trim();
    if (!name) return;
    setEditSaving(true);
    setError(null);
    try {
      const body: { name: string; value?: string; expires_on?: string | null } = { name };
      const trimmed = editValue.trim();
      if (trimmed) body.value = trimmed;
      if (editExpires.trim()) {
        body.expires_on = editExpires.trim();
      } else {
        body.expires_on = null;
      }
      await updateApiKey(token, editKey.providerId, editKey.key.id, body);
      closeEditKey();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update key");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteKey = async (providerId: number, keyId: number) => {
    if (!window.confirm("Delete this API key?")) return;
    setError(null);
    try {
      await deleteApiKey(token, providerId, keyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete key");
    }
  };

  const handleAddModel = async (providerId: number) => {
    const f = getModelForm(providerId);
    const name = f.name.trim();
    const slug = f.slug.trim();
    if (!name || !slug) return;
    setError(null);
    try {
      await createApiProviderModel(token, providerId, { name, slug });
      setModelForm(providerId, { name: "", slug: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add model");
    }
  };

  const openEditModel = (providerId: number, model: ApiProviderModelOut) => {
    setEditModel({ providerId, model });
    setEditModelName(model.name);
    setEditModelSlug(model.slug);
  };

  const closeEditModel = () => {
    setEditModel(null);
    setEditModelSaving(false);
  };

  const handleSaveEditModel = async () => {
    if (!editModel) return;
    const name = editModelName.trim();
    const slug = editModelSlug.trim();
    if (!name || !slug) return;
    setEditModelSaving(true);
    setError(null);
    try {
      await updateApiProviderModel(token, editModel.providerId, editModel.model.id, {
        name,
        slug,
      });
      closeEditModel();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update model");
    } finally {
      setEditModelSaving(false);
    }
  };

  const handleDeleteModel = async (providerId: number, modelId: number) => {
    if (!window.confirm("Delete this model?")) return;
    setError(null);
    try {
      await deleteApiProviderModel(token, providerId, modelId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete model");
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : providers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No providers yet. Use Add provider to create one.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <li
              key={p.id}
              className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {p.name}
                </h3>
                <DropdownMenu
                  overlayOnBody
                  menuButtonAriaLabel={`Actions for ${p.name}`}
                  items={[
                    {
                      label: "Edit",
                      onClick: () => openEditProvider(p),
                    },
                    {
                      label: "View API keys",
                      title: "View and manage API keys for this provider",
                      onClick: () => setKeysDialogProviderId(p.id),
                    },
                    {
                      label: "Manage models",
                      title: "Add and edit models (name + request slug) for this provider",
                      onClick: () => setModelsDialogProviderId(p.id),
                    },
                    {
                      label: "Delete",
                      onClick: () => void handleDeleteProvider(p.id),
                      danger: true,
                    },
                  ]}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="flex min-w-28 flex-1 items-baseline gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-900">
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {p.keys.length}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">API keys</span>
                </div>
                <div className="flex min-w-28 flex-1 items-baseline gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-900">
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {p.models.length}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Models</span>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex flex-col gap-0.5">
                  <dt className="font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    Created
                  </dt>
                  <dd className="text-sm text-zinc-800 dark:text-zinc-200">
                    {formatShortDate(p.created_at)}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    Updated
                  </dt>
                  <dd className="text-sm text-zinc-800 dark:text-zinc-200">
                    {p.updated_at ? formatShortDate(p.updated_at) : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        isOpen={addProviderOpen}
        onClose={() => {
          if (!addProviderSaving) closeAddProviderDialog();
        }}
        title="Add provider"
        size="md"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Provider name</span>
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="e.g. OpenAI, OpenRouter"
              autoFocus
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              disabled={addProviderSaving}
              onClick={closeAddProviderDialog}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={addProviderSaving || !newProviderName.trim()}
              onClick={() => void handleAddProvider()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {addProviderSaving ? "Saving…" : "Create provider"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={editProvider != null}
        onClose={() => {
          if (!providerEditSaving) closeEditProvider();
        }}
        title="Edit provider"
        size="md"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Provider name</span>
            <input
              type="text"
              value={providerEditName}
              onChange={(e) => setProviderEditName(e.target.value)}
              autoFocus
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              disabled={providerEditSaving}
              onClick={closeEditProvider}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={providerEditSaving || !providerEditName.trim()}
              onClick={() => void handleSaveEditProvider()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {providerEditSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={keysDialogProvider != null}
        onClose={() => setKeysDialogProviderId(null)}
        title={keysDialogProvider ? `API keys · ${keysDialogProvider.name}` : "API keys"}
        size="lg"
      >
        {keysDialogProvider ? (
          <div className="max-h-[min(70vh,36rem)] space-y-4 overflow-y-auto pr-1">
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/80">
                    <th className="py-2 pl-3 pr-2 font-medium text-zinc-700 dark:text-zinc-300">
                      Key name
                    </th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">
                      Secret (masked)
                    </th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Expires</th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Created</th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Updated</th>
                    <th className="py-2 pr-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keysDialogProvider.keys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-zinc-500 dark:text-zinc-400">
                        No keys yet. Add one below.
                      </td>
                    </tr>
                  ) : (
                    keysDialogProvider.keys.map((k) => (
                      <tr
                        key={k.id}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pl-3 pr-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {k.name}
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {k.value_masked}
                        </td>
                        <td className="py-2 pr-2 text-zinc-700 dark:text-zinc-300">
                          {formatExpiry(k.expires_on)}
                        </td>
                        <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                          {formatShortDate(k.created_at)}
                        </td>
                        <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                          {k.updated_at ? formatShortDate(k.updated_at) : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex justify-end">
                            <DropdownMenu
                              overlayOnBody
                              menuButtonAriaLabel={`Actions for API key ${k.name}`}
                              items={[
                                {
                                  label: "Edit",
                                  onClick: () => openEditKey(keysDialogProvider.id, k),
                                },
                                {
                                  label: "Delete",
                                  onClick: () => void handleDeleteKey(keysDialogProvider.id, k.id),
                                  danger: true,
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Key name
                <input
                  type="text"
                  value={getKeyForm(keysDialogProvider.id).name}
                  onChange={(e) => setKeyForm(keysDialogProvider.id, { name: e.target.value })}
                  placeholder="e.g. laptop"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>
              <label className="min-w-32 flex-1 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Key value
                <input
                  type="password"
                  autoComplete="off"
                  value={getKeyForm(keysDialogProvider.id).value}
                  onChange={(e) => setKeyForm(keysDialogProvider.id, { value: e.target.value })}
                  placeholder="Paste API key"
                  className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>
              <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Expires (optional)
                <DatePicker
                  selected={ymdStringToDate(getKeyForm(keysDialogProvider.id).expires)}
                  onChange={(d: Date | null) =>
                    setKeyForm(keysDialogProvider.id, { expires: d ? dateToYmd(d) : "" })
                  }
                  isClearable
                  placeholderText="Optional"
                  dateFormat="yyyy-MM-dd"
                  popperPlacement="bottom-start"
                  popperClassName="react-datepicker-popper-no-backdrop"
                  className={expiryDatePickerClassName}
                  wrapperClassName="w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleAddKey(keysDialogProvider.id)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Add key
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={modelsDialogProvider != null}
        onClose={() => setModelsDialogProviderId(null)}
        title={modelsDialogProvider ? `Models · ${modelsDialogProvider.name}` : "Models"}
        size="lg"
      >
        {modelsDialogProvider ? (
          <div className="max-h-[min(70vh,36rem)] space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Slug is typed exactly as your API expects (not generated from the display name).
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/80">
                    <th className="py-2 pl-3 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Slug</th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Created</th>
                    <th className="py-2 pr-2 font-medium text-zinc-700 dark:text-zinc-300">Updated</th>
                    <th className="py-2 pr-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {modelsDialogProvider.models.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-zinc-500 dark:text-zinc-400">
                        No models yet. Add one below.
                      </td>
                    </tr>
                  ) : (
                    modelsDialogProvider.models.map((m) => (
                      <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-2 pl-3 pr-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {m.name}
                        </td>
                        <td className="max-w-56 truncate py-2 pr-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          {m.slug}
                        </td>
                        <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                          {formatShortDate(m.created_at)}
                        </td>
                        <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                          {m.updated_at ? formatShortDate(m.updated_at) : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex justify-end">
                            <DropdownMenu
                              overlayOnBody
                              menuButtonAriaLabel={`Actions for model ${m.name}`}
                              items={[
                                {
                                  label: "Edit",
                                  onClick: () => openEditModel(modelsDialogProvider.id, m),
                                },
                                {
                                  label: "Delete",
                                  onClick: () => void handleDeleteModel(modelsDialogProvider.id, m.id),
                                  danger: true,
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Add model</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Name
                  <input
                    type="text"
                    value={getModelForm(modelsDialogProvider.id).name}
                    onChange={(e) => setModelForm(modelsDialogProvider.id, { name: e.target.value })}
                    placeholder="e.g. GPT-4 Turbo"
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </label>
                <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:min-w-72">
                  Slug (exact request id)
                  <input
                    type="text"
                    value={getModelForm(modelsDialogProvider.id).slug}
                    onChange={(e) => setModelForm(modelsDialogProvider.id, { slug: e.target.value })}
                    placeholder="e.g. gpt-4-turbo or google/gemini-2.0-flash"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleAddModel(modelsDialogProvider.id)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add model
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={editModel != null}
        onClose={() => {
          if (!editModelSaving) closeEditModel();
        }}
        title="Edit model"
        size="md"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Name</span>
            <input
              type="text"
              value={editModelName}
              onChange={(e) => setEditModelName(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug (exact request id)</span>
            <input
              type="text"
              value={editModelSlug}
              onChange={(e) => setEditModelSlug(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter the model string your API expects; it is not derived from the name.
            </span>
          </label>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              disabled={editModelSaving}
              onClick={closeEditModel}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                editModelSaving || !editModelName.trim() || !editModelSlug.trim()
              }
              onClick={() => void handleSaveEditModel()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {editModelSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      {editKey ? (
        <Dialog isOpen={!!editKey} onClose={closeEditKey} title="Edit API key" size="md">
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Key name</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">New secret (optional)</span>
              <input
                type="password"
                autoComplete="off"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Leave blank to keep existing key"
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Expires</span>
              <DatePicker
                selected={ymdStringToDate(editExpires)}
                onChange={(d: Date | null) => setEditExpires(d ? dateToYmd(d) : "")}
                isClearable
                placeholderText="No expiry"
                dateFormat="yyyy-MM-dd"
                popperPlacement="bottom-start"
                popperClassName="react-datepicker-popper-no-backdrop"
                className={expiryDatePickerClassNameLg}
                wrapperClassName="w-full"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Clear the date and save to remove expiry.
              </span>
            </label>
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeEditKey}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void handleSaveEditKey()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
});

