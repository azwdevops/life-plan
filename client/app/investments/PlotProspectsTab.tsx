"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { Dialog } from "@/components/Dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import {
  createPlotProspect,
  deletePlotProspect,
  createPlotStage,
  deletePlotStage,
  getPlotProspects,
  getPlotStages,
  type PlotProspect,
  type PlotProspectStage,
  updatePlotProspect,
  updatePlotStage,
} from "@/lib/api/investments";

function LocationIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export const PlotProspectsTab = memo(function PlotProspectsTab() {
  const { token } = useAuth();
  const [stages, setStages] = useState<PlotProspectStage[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [openStageMenuId, setOpenStageMenuId] = useState<number | null>(null);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [dealerName, setDealerName] = useState("");
  const [location, setLocation] = useState("");
  const [mapPin, setMapPin] = useState("");
  const [plotSize, setPlotSize] = useState("");
  const [price, setPrice] = useState("");
  const [stageId, setStageId] = useState<number | null>(null);
  const [prospects, setProspects] = useState<PlotProspect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openProspectMenuId, setOpenProspectMenuId] = useState<number | null>(null);
  const [editingProspectId, setEditingProspectId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([getPlotStages(token), getPlotProspects(token)])
      .then(([stageList, prospectList]) => {
        if (cancelled) return;
        setStages(stageList);
        setProspects(prospectList);
        if (stageList.length > 0) {
          setStageId((prev) => prev ?? stageList[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load plot data.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (stages.length > 0 && (stageId === null || !stages.some((s) => s.id === stageId))) {
      setStageId(stages[0].id);
    }
  }, [stages, stageId]);

  const sortedProspects = useMemo(
    () => [...prospects].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [prospects]
  );

  const headerActions = useMemo(
    () => [
      {
        label: "Add prospect",
        onClick: () => {
          resetForm();
          setShowCreateDialog(true);
        },
      },
      {
        label: "Manage stages",
        onClick: () => setStageDialogOpen(true),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  usePageHeaderActions(headerActions);

  const addPhoneField = () => {
    if (phones.length >= 5) return;
    setPhones((prev) => [...prev, ""]);
  };

  const updatePhone = (index: number, value: string) => {
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const removePhone = (index: number) => {
    setPhones((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const addStage = () => {
    const next = newStageName.trim();
    if (!next || !token) return;
    setError(null);
    createPlotStage(token, next)
      .then((created) => {
        setStages((prev) => [...prev, created]);
        setStageId(created.id);
        setNewStageName("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to create stage."));
  };

  const beginEditStage = (stage: PlotProspectStage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
    setOpenStageMenuId(null);
  };

  const cancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveEditStage = (stage: PlotProspectStage) => {
    renameStage(stage, editingStageName);
    setEditingStageId(null);
    setEditingStageName("");
  };

  const renameStage = (stage: PlotProspectStage, nextName: string) => {
    if (!token) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === stage.name) return;
    updatePlotStage(token, stage.id, trimmed)
      .then((updated) => {
        setStages((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setProspects((prev) =>
          prev.map((p) =>
            p.stage_id === updated.id ? { ...p, stage_name: updated.name } : p
          )
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to rename stage."));
  };

  const removeStage = (target: PlotProspectStage) => {
    if (!token || stages.length <= 1) return;
    const replacement = stages.find((s) => s.id !== target.id);
    if (!replacement) return;
    deletePlotStage(token, target.id, replacement.id)
      .then(() => {
        setStages((prev) => prev.filter((s) => s.id !== target.id));
        setProspects((prev) =>
          prev.map((p) =>
            p.stage_id === target.id
              ? { ...p, stage_id: replacement.id, stage_name: replacement.name }
              : p
          )
        );
        if (stageId === target.id) setStageId(replacement.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to remove stage."));
  };

  const resetForm = () => {
    setName("");
    setPhones([""]);
    setDealerName("");
    setLocation("");
    setMapPin("");
    setPlotSize("");
    setPrice("");
    setStageId(stages[0]?.id ?? null);
    setEditingProspectId(null);
    setError(null);
  };

  const beginEditProspect = (prospect: PlotProspect) => {
    setEditingProspectId(prospect.id);
    setName(prospect.name);
    setPhones(prospect.phones.length > 0 ? prospect.phones : [""]);
    setDealerName(prospect.dealer_name ?? "");
    setLocation(prospect.location);
    setMapPin(prospect.map_pin ?? "");
    setPlotSize(prospect.plot_size ?? "");
    setPrice(prospect.price);
    setStageId(prospect.stage_id);
    setError(null);
    setOpenProspectMenuId(null);
    setShowCreateDialog(true);
  };

  const handleDeleteProspect = async (prospectId: number) => {
    if (!token) return;
    setError(null);
    try {
      await deletePlotProspect(token, prospectId);
      setProspects((prev) => prev.filter((p) => p.id !== prospectId));
      setOpenProspectMenuId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete prospect.");
    }
  };

  const recordProspect = async () => {
    setError(null);
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    if (!name.trim()) {
      setError("Plot name is required.");
      return;
    }
    const cleanedPhones = phones.map((p) => p.trim()).filter((p) => p.length > 0);
    if (cleanedPhones.length === 0) {
      setError("At least one phone number is required.");
      return;
    }
    if (!location.trim()) {
      setError("Location is required.");
      return;
    }
    if (!price.trim()) {
      setError("Price is required.");
      return;
    }
    if (!stageId) {
      setError("Please select a stage.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        stage_id: stageId,
        name: name.trim(),
        phones: cleanedPhones,
        dealer_name: dealerName.trim() || null,
        location: location.trim(),
        map_pin: mapPin.trim() || null,
        plot_size: plotSize.trim() || null,
        price: price.trim(),
      };
      if (editingProspectId) {
        const updated = await updatePlotProspect(token, editingProspectId, payload);
        setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createPlotProspect(token, payload);
        setProspects((prev) => [created, ...prev]);
      }
      resetForm();
      setShowCreateDialog(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save prospect.");
    } finally {
      setIsSaving(false);
    }
  };

  const useCurrentLocation = () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by this device/browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setMapPin(`https://maps.google.com/?q=${lat},${lng}`);
        if (!location.trim()) {
          setLocation(`${lat}, ${lng}`);
        }
        setIsLocating(false);
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("Location permission denied. Allow location access and try again.");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setError("Location information is unavailable.");
        } else if (geoError.code === geoError.TIMEOUT) {
          setError("Location request timed out. Try again.");
        } else {
          setError("Could not retrieve current location.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recorded prospects</h3>
            {sortedProspects.length === 0 ? (
              <p className="mt-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No prospects recorded yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sortedProspects.map((p) => (
                  <div
                    key={p.id}
                    className="relative rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenProspectMenuId((prev) => (prev === p.id ? null : p.id))
                        }
                        className="rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        aria-label="Prospect actions"
                      >
                        &#8942;
                      </button>
                      {openProspectMenuId === p.id ? (
                        <div className="absolute right-0 top-full z-10 mt-1 w-24 rounded-lg border border-zinc-200 bg-white p-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => beginEditProspect(p)}
                            className="w-full rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProspect(p.id)}
                            className="w-full rounded px-2 py-1 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="pr-8">
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </h4>
                      <div className="mt-1">
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {p.stage_name}
                        </span>
                      </div>

                      <dl className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex justify-between gap-2">
                          <dt className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Phones</dt>
                          <dd className="text-right text-zinc-700 dark:text-zinc-300">{p.phones.join(", ")}</dd>
                        </div>
                        {p.dealer_name && (
                          <div className="flex justify-between gap-2">
                            <dt className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Dealer</dt>
                            <dd className="text-right text-zinc-700 dark:text-zinc-300">{p.dealer_name}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-2">
                          <dt className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Location</dt>
                          <dd className="text-right text-zinc-700 dark:text-zinc-300">
                            {p.location}
                            {p.map_pin ? (
                              <a
                                href={p.map_pin}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                map
                              </a>
                            ) : null}
                          </dd>
                        </div>
                        {p.plot_size && (
                          <div className="flex justify-between gap-2">
                            <dt className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Size</dt>
                            <dd className="text-right text-zinc-700 dark:text-zinc-300">{p.plot_size}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-2">
                          <dt className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Price</dt>
                          <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{p.price}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

      <Dialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          resetForm();
        }}
        title={editingProspectId ? "Edit plot prospect" : "Record plot prospect"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. Kamulu corner plot"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Dealer name</label>
              <input
                type="text"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. John Mwangi"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Location *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. Kitengela, Acacia area"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Google map pin / location (optional)
                </label>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={isLocating}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  title="Use current location"
                  aria-label="Use current location"
                >
                  {isLocating ? (
                    <span className="text-[10px] leading-none">...</span>
                  ) : (
                    <LocationIcon />
                  )}
                </button>
              </div>
              <input
                type="text"
                value={mapPin}
                onChange={(e) => setMapPin(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Paste map URL or pin"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Plot size</label>
              <input
                type="text"
                value={plotSize}
                onChange={(e) => setPlotSize(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. 50x100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Price *</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. 1,800,000"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Stage</label>
            <select
              value={stageId ?? 0}
              onChange={(e) => setStageId(Number.parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone numbers (max 5) *</label>
              <button
                type="button"
                onClick={addPhoneField}
                disabled={phones.length >= 5}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                + Add number
              </button>
            </div>
            <div className="space-y-2">
              {phones.map((phone, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder={`Phone ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removePhone(idx)}
                    disabled={phones.length <= 1}
                    className="rounded border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={recordProspect}
              disabled={isSaving || isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isSaving ? "Saving..." : editingProspectId ? "Update prospect" : "Save prospect"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={stageDialogOpen}
        onClose={() => setStageDialogOpen(false)}
        title="Manage stages"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="New stage name"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={addStage}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {stages.map((s) => (
              <div
                key={s.id}
                className="relative flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                {editingStageId === s.id ? (
                  <div className="flex w-full items-center gap-2">
                    <input
                      type="text"
                      value={editingStageName}
                      onChange={(e) => setEditingStageName(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => saveEditStage(s)}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditStage}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">{s.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenStageMenuId((prev) => (prev === s.id ? null : s.id))
                      }
                      className="rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      aria-label="Stage actions"
                    >
                      &#8942;
                    </button>
                  </>
                )}

                {openStageMenuId === s.id && editingStageId !== s.id ? (
                  <div className="absolute right-2 top-10 z-10 w-24 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => beginEditStage(s)}
                      className="w-full rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenStageMenuId(null);
                        removeStage(s);
                      }}
                      disabled={stages.length <= 1}
                      className="w-full rounded px-2 py-1 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
});
