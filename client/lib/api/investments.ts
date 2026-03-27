import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface PlotProspectStage {
  id: number;
  user_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface PlotProspect {
  id: number;
  user_id: number;
  stage_id: number;
  stage_name: string;
  name: string;
  phones: string[];
  dealer_name: string | null;
  location: string;
  map_pin: string | null;
  plot_size: string | null;
  price: string;
  created_at: string;
  updated_at: string | null;
}

export interface PlotProspectCreate {
  stage_id: number;
  name: string;
  phones: string[];
  dealer_name?: string | null;
  location: string;
  map_pin?: string | null;
  plot_size?: string | null;
  price: string;
}

export interface PlotProspectUpdate extends PlotProspectCreate {}

export async function getPlotStages(token: string): Promise<PlotProspectStage[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-stages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to fetch plot stages");
  return response.json();
}

export async function createPlotStage(token: string, name: string): Promise<PlotProspectStage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-stages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to create stage" }));
    throw new Error(err.detail || "Failed to create stage");
  }
  return response.json();
}

export async function updatePlotStage(token: string, stageId: number, name: string): Promise<PlotProspectStage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-stages/${stageId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to update stage" }));
    throw new Error(err.detail || "Failed to update stage");
  }
  return response.json();
}

export async function deletePlotStage(
  token: string,
  stageId: number,
  replacementStageId?: number
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-stages/${stageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replacement_stage_id: replacementStageId ?? null }),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to delete stage" }));
    throw new Error(err.detail || "Failed to delete stage");
  }
}

export async function getPlotProspects(token: string): Promise<PlotProspect[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-prospects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to fetch plot prospects");
  return response.json();
}

export async function createPlotProspect(token: string, data: PlotProspectCreate): Promise<PlotProspect> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-prospects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to create plot prospect" }));
    throw new Error(err.detail || "Failed to create plot prospect");
  }
  return response.json();
}

export async function updatePlotProspect(
  token: string,
  prospectId: number,
  data: PlotProspectUpdate
): Promise<PlotProspect> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-prospects/${prospectId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to update plot prospect" }));
    throw new Error(err.detail || "Failed to update plot prospect");
  }
  return response.json();
}

export async function deletePlotProspect(token: string, prospectId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/plot-prospects/${prospectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to delete plot prospect" }));
    throw new Error(err.detail || "Failed to delete plot prospect");
  }
}
