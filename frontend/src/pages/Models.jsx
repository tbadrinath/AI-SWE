import React, { useEffect, useState } from "react";
import { endpoints, fmt } from "../lib/api";
import { Boxes, Code2, MessageSquare, Eye, HardDrive, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Models() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanInfo, setScanInfo] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await endpoints.scanModels();
      setScanInfo(res);
      setModels(res.models);
    } catch (e) {
      toast.error("Failed to scan HF cache");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = scanInfo?.total_size_bytes || 0;
  const suggested = scanInfo?.suggested_model;

  return (
    <div className="space-y-6" data-testid="models-root">
      {/* Scan summary */}
      <div className="grid grid-cols-2 border border-neutral-900 md:grid-cols-4" data-testid="scan-summary">
        <SummaryCell label="Detected" value={models.length} testid="summary-detected" />
        <SummaryCell label="Total on disk" value={fmt.bytes(total)} mono testid="summary-size" />
        <SummaryCell
          label="Cache dir"
          value={scanInfo?.cache_dir || "—"}
          mono
          small
          testid="summary-cache"
        />
        <SummaryCell label="Suggested" value={suggested || "—"} mono small last testid="summary-suggested" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="overline">Model Registry</div>
          <p className="font-mono text-xs text-neutral-600">
            Scanned from <span className="text-neutral-900">~/.cache/huggingface/hub</span> &middot; auto-selected best coding model
          </p>
        </div>
        <button
          onClick={load}
          data-testid="rescan-btn"
          className="inline-flex items-center gap-2 border border-neutral-900 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "spin-slow" : ""}`} strokeWidth={1.5} />
          Rescan
        </button>
      </div>

      <div className="grid grid-cols-1 border border-neutral-900 md:grid-cols-2" data-testid="models-grid">
        {models.map((m, idx) => (
          <ModelCard
            key={m.repo_id}
            m={m}
            isSuggested={m.repo_id === suggested}
            borderRight={idx % 2 === 0}
            borderBottom={idx < models.length - (models.length % 2 === 0 ? 2 : 1)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, mono, small, last, testid }) {
  return (
    <div
      className={`flex flex-col justify-between bg-white p-6 ${last ? "" : "border-r border-neutral-900"}`}
      data-testid={testid}
    >
      <span className="overline">{label}</span>
      <span
        className={`mt-3 ${mono ? "font-mono" : "font-heading"} ${small ? "truncate text-sm" : "text-3xl font-black"}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function ModelCard({ m, isSuggested, borderRight, borderBottom }) {
  const caps = m.capabilities || {};
  return (
    <div
      className={`group relative bg-white p-6 transition-colors hover:bg-neutral-50 ${borderRight ? "md:border-r md:border-neutral-900" : ""} ${borderBottom ? "border-b border-neutral-900" : ""}`}
      data-testid={`model-card-${m.repo_id.replace(/\//g, "-")}`}
    >
      {isSuggested && (
        <div className="absolute right-0 top-0 inline-flex items-center gap-1 bg-[var(--ab-klein-blue)] px-2 py-1 text-white">
          <Zap className="h-3 w-3" strokeWidth={2} />
          <span className="font-mono text-[10px] uppercase tracking-wider">auto-selected</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="overline">Model</div>
          <h3 className="mt-1 font-heading text-xl font-black tracking-tight">
            {m.repo_id.split("/").pop()}
          </h3>
          <p className="font-mono text-[11px] text-neutral-500">{m.repo_id.split("/")[0]}</p>
        </div>
        <Boxes className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.5} />
      </div>

      <p className="mt-3 text-sm text-neutral-700 leading-relaxed">{m.notes}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {caps.code && (
          <span className="pill border-neutral-900 bg-neutral-900 text-white">
            <Code2 className="mr-0.5 h-2.5 w-2.5" strokeWidth={2} />
            code
          </span>
        )}
        {caps.chat && (
          <span className="pill border-neutral-900 bg-white text-neutral-900">
            <MessageSquare className="mr-0.5 h-2.5 w-2.5" strokeWidth={2} />
            chat
          </span>
        )}
        {caps.vision && (
          <span className="pill border-[var(--ab-klein-blue)] bg-[var(--ab-klein-blue)] text-white">
            <Eye className="mr-0.5 h-2.5 w-2.5" strokeWidth={2} />
            vision
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed border-neutral-300 pt-4 font-mono text-[11px]">
        <Field k="params" v={`${m.params_b}B`} />
        <Field k="ctx" v={`${m.context_length.toLocaleString()} tok`} />
        <Field k="dtype" v={m.quantization} />
        <Field k="size" v={fmt.bytes(m.size_on_disk)} />
        <div className="col-span-2 flex items-center gap-2 pt-1">
          <HardDrive className="h-3 w-3 text-neutral-400" strokeWidth={1.5} />
          <span className="truncate text-neutral-500" title={m.path}>
            {m.path}
          </span>
        </div>
      </dl>
    </div>
  );
}

function Field({ k, v }) {
  return (
    <>
      <dt className="text-neutral-500 uppercase tracking-wider">{k}</dt>
      <dd className="text-neutral-900">{v}</dd>
    </>
  );
}
