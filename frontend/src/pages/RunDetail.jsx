import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { endpoints, fmt } from "../lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  RadioTower,
  XCircle,
  FileCode,
  Terminal,
  Eye,
  AlertTriangle,
} from "lucide-react";

const STAGE_COLORS = {
  plan: "bg-white text-neutral-900 border-neutral-900",
  code: "bg-neutral-900 text-white border-neutral-900",
  test: "bg-[var(--ab-klein-blue)] text-white border-[var(--ab-klein-blue)]",
  perceive: "bg-white text-neutral-900 border-neutral-900",
  diagnose: "bg-[var(--ab-warning-yellow)] text-black border-black",
  fix: "bg-[var(--ab-signal-red)] text-white border-[var(--ab-signal-red)]",
  done: "bg-[var(--ab-success-green)] text-white border-[var(--ab-success-green)]",
};

export default function RunDetail() {
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedIter, setSelectedIter] = useState(1);
  const pollRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const [r, ev] = await Promise.all([
        endpoints.getRun(runId),
        endpoints.getRunEvents(runId),
      ]);
      setRun(r);
      setEvents(ev);
      if (ev.length > 0) {
        const maxIter = Math.max(...ev.map((e) => e.iteration));
        setSelectedIter((s) => (s > maxIter ? maxIter : s || maxIter));
      }
    };
    load();
    pollRef.current = setInterval(async () => {
      const r = await endpoints.getRun(runId);
      const ev = await endpoints.getRunEvents(runId);
      setRun(r);
      setEvents(ev);
      if (r.status !== "running" && r.status !== "queued") {
        clearInterval(pollRef.current);
      }
    }, 1200);
    return () => clearInterval(pollRef.current);
  }, [runId]);

  const iterations = useMemo(() => {
    const set = new Set(events.map((e) => e.iteration));
    return Array.from(set).sort((a, b) => a - b);
  }, [events]);

  const iterEvents = useMemo(
    () => events.filter((e) => e.iteration === selectedIter),
    [events, selectedIter],
  );

  const codeEv = [...iterEvents].reverse().find((e) => e.type === "code");
  const testEv = iterEvents.find((e) => e.type === "test_result");
  const diagEv = iterEvents.find((e) => e.type === "diagnosis");
  const visionEvs = iterEvents.filter((e) => e.type === "vision");

  if (!run) {
    return <div className="font-mono text-sm text-neutral-500">Loading run…</div>;
  }

  const StatusIcon = {
    running: RadioTower,
    queued: CircleDashed,
    completed: CheckCircle2,
    failed: XCircle,
  }[run.status] || CircleDashed;

  const statusColor = {
    running: "text-[var(--ab-klein-blue)]",
    queued: "text-neutral-600",
    completed: "text-[var(--ab-success-green)]",
    failed: "text-[var(--ab-signal-red)]",
  }[run.status];

  return (
    <div className="space-y-6" data-testid="run-detail-root">
      <Link
        to="/runs"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900"
        data-testid="back-to-runs"
      >
        <ArrowLeft className="h-3 w-3" /> back to runs
      </Link>

      {/* Header */}
      <div className="grid grid-cols-1 border border-neutral-900 md:grid-cols-4">
        <HeaderCell label="status">
          <span className={`inline-flex items-center gap-1.5 ${statusColor}`}>
            <StatusIcon
              className={`h-4 w-4 ${run.status === "running" ? "pulse-dot" : ""}`}
              strokeWidth={1.5}
            />
            <span className="font-mono text-[12px] uppercase tracking-wider">{run.status}</span>
          </span>
        </HeaderCell>
        <HeaderCell label="model" mono>{run.model_repo_id}</HeaderCell>
        <HeaderCell label="iterations" mono>
          {(run.iterations_used ?? iterations.length)} / {run.max_iterations}
        </HeaderCell>
        <HeaderCell label="duration" mono last>
          {fmt.dur(run.started_at || run.created_at, run.finished_at)}
        </HeaderCell>
      </div>

      <div className="widget">
        <div className="overline">Task</div>
        <h2 className="mt-2 font-heading text-2xl font-black tracking-tight">{run.name}</h2>
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-neutral-700">{run.spec}</p>
      </div>

      {/* Iteration tabs */}
      {iterations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="iteration-tabs">
          <span className="overline">iteration</span>
          {iterations.map((i) => (
            <button
              key={i}
              onClick={() => setSelectedIter(i)}
              className={`border border-neutral-900 px-3 py-1 font-mono text-[12px] ${i === selectedIter ? "bg-neutral-900 text-white" : "bg-white"}`}
              data-testid={`iter-tab-${i}`}
            >
              #{i}
            </button>
          ))}
        </div>
      )}

      {/* Iteration content */}
      <div className="grid gap-0 border border-neutral-900 md:grid-cols-12">
        <div className="md:col-span-8 border-b border-neutral-900 md:border-b-0 md:border-r">
          <SectionHeader icon={FileCode} label="code" />
          <div className="relative bg-[var(--ab-terminal-bg)] scanlines">
            <pre className="max-h-[480px] overflow-auto p-5 font-mono text-[12px] leading-[1.55] text-[var(--ab-terminal-text)]">
              <code className="whitespace-pre">
                {codeEv?.data?.code || "// No code yet for this iteration"}
              </code>
            </pre>
          </div>

          <SectionHeader icon={Terminal} label="event log" />
          <div className="max-h-64 overflow-auto">
            {iterEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2 text-[12px]"
                data-testid={`event-row-${e.id}`}
              >
                <span className={`pill ${STAGE_COLORS[e.stage] || "border-neutral-900 bg-white"}`}>
                  {e.stage}
                </span>
                <span className="font-mono text-neutral-800">{e.title}</span>
                <span className="ml-auto font-mono text-[10.5px] text-neutral-500">
                  {fmt.time(e.timestamp)}
                </span>
              </div>
            ))}
            {iterEvents.length === 0 && (
              <div className="p-4 font-mono text-xs text-neutral-500">No events for this iteration.</div>
            )}
          </div>
        </div>

        <div className="md:col-span-4">
          <SectionHeader icon={Eye} label="perception" />
          <div className="space-y-2 p-5">
            {visionEvs.length === 0 && (
              <div className="font-mono text-[11px] text-neutral-500">— no vision events —</div>
            )}
            {visionEvs.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-dashed border-neutral-200 py-1.5">
                <span className="font-mono text-[11px]">{e.title}</span>
                <span className="font-mono-num text-[11px] text-neutral-600">
                  {(e.data?.confidence ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <SectionHeader icon={AlertTriangle} label="diagnosis" />
          <div className="p-5">
            {!diagEv && (
              <div className="font-mono text-[11px] text-neutral-500">Awaiting diagnosis…</div>
            )}
            {diagEv && (
              <>
                <span
                  className={`pill ${
                    diagEv.data.status === "ok"
                      ? "border-[var(--ab-success-green)] bg-[var(--ab-success-green)] text-white"
                      : "border-[var(--ab-signal-red)] bg-[var(--ab-signal-red)] text-white"
                  }`}
                >
                  {diagEv.data.status.toUpperCase()}
                </span>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-neutral-800">
                  {diagEv.data.reason}
                </p>
                {testEv && (
                  <p className="mt-3 font-mono text-[11px] text-neutral-600">
                    test: <span className={testEv.data.status === "PASS" ? "text-[var(--ab-success-green)]" : "text-[var(--ab-signal-red)]"}>{testEv.data.status}</span>
                    {testEv.data.reason ? ` — ${testEv.data.reason}` : ""}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({ label, children, mono, last }) {
  return (
    <div className={`flex flex-col justify-between bg-white p-5 ${last ? "" : "border-r border-neutral-900"}`}>
      <span className="overline">{label}</span>
      <div className={`mt-3 ${mono ? "font-mono text-sm" : "text-sm"}`}>{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-900 bg-white px-5 py-3">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      <span className="font-mono text-[11px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
