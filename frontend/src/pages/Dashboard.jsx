import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { endpoints, fmt } from "../lib/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Cpu,
  FileCode,
  GitBranch,
  Hexagon,
  Play,
  RadioTower,
  XCircle,
} from "lucide-react";

const STAGE_ORDER = ["plan", "code", "test", "perceive", "diagnose", "fix", "done"];
const STAGE_LABEL = {
  plan: "PLAN",
  code: "CODE",
  test: "TEST",
  perceive: "PERCEIVE",
  diagnose: "DIAGNOSE",
  fix: "FIX",
  done: "DONE",
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const s = await endpoints.latestSummary();
      setSummary(s);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    pollRef.current = setInterval(fetchSummary, 1200);
    return () => clearInterval(pollRef.current);
  }, []);

  const run = summary?.run;
  const events = summary?.events || [];
  const stats = summary?.stats || { total: 0, completed: 0, failed: 0, running: 0 };

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      {/* North star metrics */}
      <div className="grid grid-cols-2 border border-neutral-900 md:grid-cols-4" data-testid="metrics-row">
        <MetricCell label="Total runs" value={stats.total} accent="neutral" testid="metric-total" />
        <MetricCell
          label="Running"
          value={stats.running}
          accent="blue"
          testid="metric-running"
          pulse={stats.running > 0}
        />
        <MetricCell label="Completed" value={stats.completed} accent="green" testid="metric-completed" />
        <MetricCell label="Failed" value={stats.failed} accent="red" last testid="metric-failed" />
      </div>

      {!run && !loading && <EmptyState />}

      {run && (
        <div className="grid gap-0 border border-neutral-900 md:grid-cols-12">
          {/* Left: run meta + iteration timeline */}
          <div className="md:col-span-4 border-b border-neutral-900 md:border-b-0 md:border-r">
            <RunMeta run={run} events={events} />
            <IterationTimeline events={events} run={run} />
          </div>

          {/* Center: live code viewer */}
          <div className="md:col-span-5 border-b border-neutral-900 md:border-b-0 md:border-r">
            <LiveCode events={events} run={run} />
          </div>

          {/* Right: perception + diagnosis */}
          <div className="md:col-span-3">
            <PerceptionPanel events={events} />
            <DiagnosisPanel events={events} />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="widget flex flex-col items-start gap-4" data-testid="dashboard-empty">
      <div className="overline">No run yet</div>
      <h2 className="font-heading text-2xl font-black tracking-tight">
        Start your first autonomous run.
      </h2>
      <p className="max-w-xl text-sm text-neutral-600">
        The agent will generate code, launch it, continuously perceive the UI with OpenCV-style watchers,
        run Playwright tests, and self-repair until the acceptance criteria pass.
      </p>
      <Link
        to="/tasks"
        data-testid="empty-start-btn"
        className="inline-flex items-center gap-2 border border-neutral-900 bg-[var(--ab-klein-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[#001e6e]"
      >
        <Play className="h-4 w-4" />
        New task
      </Link>
    </div>
  );
}

function MetricCell({ label, value, accent, last, pulse, testid }) {
  const accentColor = {
    neutral: "text-neutral-900",
    blue: "text-[var(--ab-klein-blue)]",
    green: "text-[var(--ab-success-green)]",
    red: "text-[var(--ab-signal-red)]",
  }[accent];
  return (
    <div
      className={`flex flex-col justify-between bg-white p-6 ${last ? "" : "border-r border-neutral-900"}`}
      data-testid={testid}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 ${pulse ? "pulse-dot" : ""} bg-current ${accentColor}`} />
        <span className="overline">{label}</span>
      </div>
      <div className={`mt-4 font-mono-num text-5xl font-medium ${accentColor}`}>
        {String(value).padStart(2, "0")}
      </div>
    </div>
  );
}

function RunMeta({ run, events }) {
  const statusColor = {
    running: "text-[var(--ab-klein-blue)]",
    queued: "text-neutral-600",
    completed: "text-[var(--ab-success-green)]",
    failed: "text-[var(--ab-signal-red)]",
  }[run.status] || "text-neutral-900";

  const Icon = {
    running: RadioTower,
    queued: CircleDashed,
    completed: CheckCircle2,
    failed: XCircle,
  }[run.status] || Activity;

  const latestIter =
    events.length > 0 ? Math.max(...events.map((e) => e.iteration)) : 0;

  return (
    <div className="border-b border-neutral-900 p-6" data-testid="run-meta">
      <div className="flex items-center justify-between">
        <span className="overline">Active run</span>
        <span className={`inline-flex items-center gap-1.5 ${statusColor}`}>
          <Icon className={`h-3.5 w-3.5 ${run.status === "running" ? "pulse-dot" : ""}`} strokeWidth={1.5} />
          <span className="font-mono text-[11px] uppercase tracking-wider">{run.status}</span>
        </span>
      </div>
      <div className="mt-3 font-heading text-xl font-black leading-tight tracking-tight">
        {run.name}
      </div>
      <div className="mt-2 text-[13px] text-neutral-600 line-clamp-3">{run.spec}</div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
        <Meta k="model" v={run.model_repo_id} />
        <Meta k="iter" v={`${latestIter} / ${run.max_iterations}`} />
        <Meta k="started" v={fmt.time(run.started_at || run.created_at)} />
        <Meta k="elapsed" v={fmt.dur(run.started_at || run.created_at, run.finished_at)} />
      </dl>
    </div>
  );
}

function Meta({ k, v }) {
  return (
    <>
      <dt className="text-neutral-500 uppercase tracking-wider">{k}</dt>
      <dd className="truncate text-neutral-900">{v || "—"}</dd>
    </>
  );
}

function IterationTimeline({ events, run }) {
  const iterations = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      if (!map.has(e.iteration)) map.set(e.iteration, new Set());
      map.get(e.iteration).add(e.stage);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [events]);

  return (
    <div className="p-6" data-testid="iteration-timeline">
      <div className="overline mb-4">Iteration timeline</div>
      <div className="space-y-3">
        {iterations.length === 0 && (
          <div className="font-mono text-xs text-neutral-500">Awaiting first iteration…</div>
        )}
        {iterations.map(([iter, stages]) => {
          const passed = events.some(
            (e) => e.iteration === iter && e.type === "test_result" && e.data?.status === "PASS",
          );
          const failed = events.some(
            (e) => e.iteration === iter && e.type === "test_result" && e.data?.status === "FAIL",
          );
          return (
            <div key={iter} className="flex items-start gap-3" data-testid={`iter-row-${iter}`}>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-900 bg-white font-mono-num text-[11px] font-medium">
                {iter}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {STAGE_ORDER.map((s) => {
                    const done = stages.has(s);
                    const isCurrent = done && !passed && !failed && s === lastStage(stages);
                    return (
                      <span
                        key={s}
                        className={`pill ${
                          done
                            ? passed && s === "done"
                              ? "border-[var(--ab-success-green)] bg-[var(--ab-success-green)] text-white"
                              : failed && s === "diagnose"
                                ? "border-[var(--ab-signal-red)] bg-[var(--ab-signal-red)] text-white"
                                : "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 text-neutral-400"
                        } ${isCurrent ? "pulse-dot" : ""}`}
                      >
                        {STAGE_LABEL[s]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function lastStage(stages) {
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    if (stages.has(STAGE_ORDER[i])) return STAGE_ORDER[i];
  }
  return null;
}

function LiveCode({ events, run }) {
  const lastCodeEvent = [...events].reverse().find((e) => e.type === "code");
  const code = lastCodeEvent?.data?.code || (run.final_code || "// Awaiting first code generation…");
  const lang = lastCodeEvent?.data?.language || "html";

  return (
    <div className="flex h-full min-h-[420px] flex-col" data-testid="live-code">
      <div className="flex items-center justify-between border-b border-neutral-900 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4" strokeWidth={1.5} />
          <span className="font-mono text-[11px] uppercase tracking-wider">live code viewer</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            lang: {lang}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            iter: {lastCodeEvent?.iteration ?? "—"}
          </span>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden bg-[var(--ab-terminal-bg)] scanlines">
        <pre className="h-full max-h-[520px] overflow-auto p-5 text-[12.5px] leading-[1.55] text-[var(--ab-terminal-text)]">
          <code className="font-mono whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

function PerceptionPanel({ events }) {
  const visionEvents = events.filter((e) => e.stage === "perceive" && e.type === "vision");
  const counts = visionEvents.reduce((acc, e) => {
    acc[e.title] = (acc[e.title] || 0) + 1;
    return acc;
  }, {});
  const types = [
    { k: "motion_detected", label: "Motion", accent: "bg-neutral-900" },
    { k: "screen_possibly_stuck", label: "Stuck", accent: "bg-[var(--ab-warning-yellow)] text-black" },
    { k: "error_like_red_region", label: "Red", accent: "bg-[var(--ab-signal-red)] text-white" },
    { k: "spinner_detected", label: "Spinner", accent: "bg-[var(--ab-klein-blue)] text-white" },
    { k: "toast_detected", label: "Toast", accent: "bg-neutral-700 text-white" },
  ];

  return (
    <div className="border-b border-neutral-900 p-5" data-testid="perception-panel">
      <div className="flex items-center justify-between">
        <span className="overline">Continuous perception</span>
        <Hexagon className="h-3.5 w-3.5 text-neutral-600" strokeWidth={1.5} />
      </div>

      <div className="mt-4 space-y-2">
        {types.map((t) => (
          <div key={t.k} className="flex items-center justify-between" data-testid={`vision-count-${t.k}`}>
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
              {t.label}
            </span>
            <span className={`pill ${t.accent}`}>
              {String(counts[t.k] || 0).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-dashed border-neutral-300 pt-4">
        <div className="overline mb-2">Recent events</div>
        <div className="max-h-40 space-y-1 overflow-auto pr-1">
          {visionEvents.slice(-8).reverse().map((e) => (
            <div
              key={e.id}
              className="line-in flex items-center justify-between font-mono text-[10.5px] text-neutral-700"
            >
              <span className="truncate">{e.title}</span>
              <span className="tabular-nums text-neutral-500">
                {(e.data?.confidence ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
          {visionEvents.length === 0 && (
            <div className="font-mono text-[10.5px] text-neutral-400">— no events yet —</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosisPanel({ events }) {
  const diag = [...events].reverse().find((e) => e.type === "diagnosis");
  if (!diag) {
    return (
      <div className="p-5" data-testid="diagnosis-empty">
        <span className="overline">Diagnosis</span>
        <div className="mt-3 font-mono text-[11px] text-neutral-500">Awaiting…</div>
      </div>
    );
  }
  const isFail = diag.data?.status === "fail";
  return (
    <div className="p-5" data-testid="diagnosis-panel">
      <div className="flex items-center justify-between">
        <span className="overline">Diagnosis</span>
        {isFail ? (
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--ab-signal-red)]" strokeWidth={1.5} />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ab-success-green)]" strokeWidth={1.5} />
        )}
      </div>
      <div
        className={`mt-2 pill ${
          isFail
            ? "border-[var(--ab-signal-red)] bg-[var(--ab-signal-red)] text-white"
            : "border-[var(--ab-success-green)] bg-[var(--ab-success-green)] text-white"
        }`}
      >
        {diag.data.status.toUpperCase()}
      </div>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-neutral-700">
        {diag.data.reason || "—"}
      </p>
      {diag.data?.vision_flags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {diag.data.vision_flags.map((f) => (
            <span key={f} className="pill border-neutral-900 bg-white text-neutral-900">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
