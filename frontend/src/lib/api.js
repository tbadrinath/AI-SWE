import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 30000 });

export const endpoints = {
  scanModels: () => api.post("/models/scan").then((r) => r.data),
  listModels: () => api.get("/models").then((r) => r.data),
  listPhases: () => api.get("/phases").then((r) => r.data),
  listTasks: () => api.get("/tasks").then((r) => r.data),
  createTask: (payload) => api.post("/tasks", payload).then((r) => r.data),
  startRun: (payload) => api.post("/runs/start", payload).then((r) => r.data),
  listRuns: () => api.get("/runs").then((r) => r.data),
  getRun: (id) => api.get(`/runs/${id}`).then((r) => r.data),
  getRunEvents: (id, since) =>
    api
      .get(`/runs/${id}/events`, { params: since ? { since } : {} })
      .then((r) => r.data),
  getRunApprovals: (id) => api.get(`/runs/${id}/approvals`).then((r) => r.data),
  submitRunApproval: (id, payload) => api.post(`/runs/${id}/approvals`, payload).then((r) => r.data),
  latestSummary: () => api.get("/runs/latest/summary").then((r) => r.data),
  downloadPhase1Url: `${API}/download/phase1.zip`,
};

export const fmt = {
  bytes(b) {
    if (!b && b !== 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let n = Number(b);
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  },
  time(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  },
  dur(startIso, endIso) {
    if (!startIso) return "—";
    const end = endIso ? new Date(endIso) : new Date();
    const ms = end - new Date(startIso);
    if (ms < 0) return "—";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
  },
};
