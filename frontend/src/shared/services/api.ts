import type { ChatResponse, DatasetRecord } from "@/shared/types/dataset";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const datasetApi = {
  getCurrent: () => request<DatasetRecord | null>("/api/datasets/current"),
  upload: (payload: { fileName: string; csv: string }) =>
    request<DatasetRecord>("/api/datasets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  clear: () =>
    request<{ success: boolean }>("/api/datasets/current", {
      method: "DELETE",
    }),
};

export const chatApi = {
  send: (message: string) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
