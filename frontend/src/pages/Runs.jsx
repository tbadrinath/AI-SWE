import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, fmt } from "../lib/api";
import { CheckCircle2, CircleDashed, Play, RadioTower, XCircle } from "lucide-react";

const STATUS = {
  running: { icon: RadioTower, color: "text-[var(--ab-klein-blue)]", label: "running" },
  queued: { icon: CircleDashed, color: "text-neutral-600", label: "queued" },
  completed: { icon: CheckCircle2, color: "text-[var(--ab-success-green)]", label: "completed" },
  failed: { icon: XCircle, color: "text-[var(--ab-signal-red)]", label: "failed" },
};

export default function Runs() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const r = await endpoints.listRuns();
      setRuns(r);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="font-mono text-sm text-neutral-500">Loading runs…</div>;

  if (runs.length === 0) {
    return (
      <div className="widget" data-testid="runs-empty">
        <div className="overline">No runs yet</div>
        <p className="mt-2 text-sm text-neutral-600">Start a task to populate this view.</p>
        <Link
          to="/tasks"
          className="mt-4 inline-flex items-center gap-2 border border-neutral-900 bg-[var(--ab-klein-blue)] px-4 py-2 text-sm font-medium text-white"
          data-testid="runs-new-btn"
        >
          <Play className="h-4 w-4" />
          New task
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-neutral-900" data-testid="runs-table-wrap">
      <table className="w-full border-collapse" data-testid="runs-table">
        <thead>
          <tr className="bg-neutral-900 text-white">
            <Th>status</Th>
            <Th>name</Th>
            <Th>model</Th>
            <Th>iter</Th>
            <Th>created</Th>
            <Th>duration</Th>
            <Th right>open</Th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const meta = STATUS[r.status] || STATUS.queued;
            const Icon = meta.icon;
            return (
              <tr
                key={r.id}
                className="border-t border-neutral-200 hover:bg-neutral-50"
                data-testid={`run-row-${r.id}`}
              >
                <Td>
                  <span className={`inline-flex items-center gap-1.5 ${meta.color}`}>
                    <Icon
                      className={`h-3.5 w-3.5 ${r.status === "running" ? "pulse-dot" : ""}`}
                      strokeWidth={1.5}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wider">
                      {meta.label}
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="truncate">{r.name}</span>
                </Td>
                <Td mono>{r.model_repo_id}</Td>
                <Td mono>{(r.iterations_used ?? 0)} / {r.max_iterations}</Td>
                <Td mono>{fmt.time(r.created_at)}</Td>
                <Td mono>{fmt.dur(r.started_at || r.created_at, r.finished_at)}</Td>
                <Td right>
                  <Link
                    to={`/runs/${r.id}`}
                    className="border border-neutral-900 px-2 py-1 text-[11px] font-mono uppercase tracking-wider hover:bg-neutral-900 hover:text-white"
                    data-testid={`open-run-${r.id}`}
                  >
                    view →
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th
      className={`border-r border-neutral-700 px-4 py-2 font-mono text-[10px] uppercase tracking-wider ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, mono, right }) {
  return (
    <td
      className={`border-r border-neutral-200 px-4 py-2.5 text-[13px] ${mono ? "font-mono" : ""} ${right ? "text-right" : ""}`}
    >
      {children}
    </td>
  );
}
