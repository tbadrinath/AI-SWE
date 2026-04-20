import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { endpoints } from "../lib/api";
import { Play, Save, FileText, Braces } from "lucide-react";
import { toast } from "sonner";

const EXAMPLES = [
  {
    name: "Landing page with CTA",
    spec: "Build a one-page landing site for a fictional task manager. Include a hero headline, one CTA button ('Get started') that scrolls to a feature grid, and a 3-column feature grid. The page must visibly render the word 'Hello' somewhere in the hero.",
  },
  {
    name: "Todo list with persistence",
    spec: "Build a single-file todo app that supports adding, deleting, and completing tasks. Tasks persist in localStorage. The page must render the heading 'Hello Tasks'.",
  },
  {
    name: "Interactive counter",
    spec: "Build a single HTML file with an interactive counter. Increment and decrement buttons. Display current value. Title the page 'Hello Counter'.",
  },
];

export default function TaskBuilder() {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [name, setName] = useState("My first autonomous run");
  const [spec, setSpec] = useState(EXAMPLES[0].spec);
  const [modelRepoId, setModelRepoId] = useState("");
  const [maxIter, setMaxIter] = useState(4);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    endpoints.listModels().then((m) => {
      setModels(m);
      const def = m.find((x) => x.capabilities.code) || m[0];
      if (def) setModelRepoId(def.repo_id);
    });
  }, []);

  const jsonPreview = useMemo(
    () =>
      JSON.stringify(
        { name, spec, model_repo_id: modelRepoId, max_iterations: Number(maxIter) },
        null,
        2,
      ),
    [name, spec, modelRepoId, maxIter],
  );

  const applyExample = (ex) => {
    setName(ex.name);
    setSpec(ex.spec);
  };

  const startNow = async () => {
    if (!spec.trim()) return toast.error("Spec is required");
    setSubmitting(true);
    try {
      const run = await endpoints.startRun({
        name,
        spec,
        model_repo_id: modelRepoId,
        max_iterations: Number(maxIter),
      });
      toast.success("Run started");
      navigate(`/runs/${run.id}`);
    } catch (e) {
      toast.error("Failed to start run");
    } finally {
      setSubmitting(false);
    }
  };

  const saveTask = async () => {
    try {
      await endpoints.createTask({
        name,
        spec,
        model_repo_id: modelRepoId,
        max_iterations: Number(maxIter),
      });
      toast.success("Task saved");
    } catch (e) {
      toast.error("Failed to save task");
    }
  };

  return (
    <div className="grid gap-0 border border-neutral-900 md:grid-cols-2" data-testid="task-builder-root">
      {/* Left: form */}
      <div className="border-b border-neutral-900 p-6 md:border-b-0 md:border-r md:p-8">
        <div className="overline mb-4 flex items-center gap-2">
          <FileText className="h-3 w-3" strokeWidth={1.5} />
          Task specification
        </div>

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="task-name-input"
            className="mt-1 w-full border border-neutral-900 bg-white px-3 py-2 text-sm outline-none focus:bg-neutral-50"
          />
        </label>

        <label className="mt-4 block">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
            spec (what the agent should build)
          </span>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            rows={8}
            data-testid="task-spec-textarea"
            className="mt-1 w-full border border-neutral-900 bg-white px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:bg-neutral-50"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
              model
            </span>
            <select
              value={modelRepoId}
              onChange={(e) => setModelRepoId(e.target.value)}
              data-testid="task-model-select"
              className="mt-1 w-full border border-neutral-900 bg-white px-3 py-2 text-sm outline-none"
            >
              {models.map((m) => (
                <option key={m.repo_id} value={m.repo_id}>
                  {m.repo_id}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
              max iterations
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxIter}
              onChange={(e) => setMaxIter(e.target.value)}
              data-testid="task-max-iter-input"
              className="mt-1 w-full border border-neutral-900 bg-white px-3 py-2 font-mono-num text-sm outline-none"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="overline mb-2">Quick examples</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                onClick={() => applyExample(ex)}
                data-testid={`example-btn-${ex.name.toLowerCase().replace(/\s+/g, "-")}`}
                className="border border-neutral-300 bg-white px-2.5 py-1 text-[11px] hover:border-neutral-900"
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={startNow}
            disabled={submitting}
            data-testid="start-run-btn"
            className="inline-flex items-center gap-2 border border-neutral-900 bg-[var(--ab-klein-blue)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#001e6e] disabled:opacity-60"
          >
            <Play className="h-4 w-4" strokeWidth={2} />
            {submitting ? "Starting…" : "Start run"}
          </button>
          <button
            onClick={saveTask}
            data-testid="save-task-btn"
            className="inline-flex items-center gap-2 border border-neutral-900 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-100"
          >
            <Save className="h-4 w-4" strokeWidth={1.5} />
            Save task
          </button>
        </div>
      </div>

      {/* Right: JSON preview */}
      <div className="bg-[var(--ab-terminal-bg)] p-6 md:p-8" data-testid="json-preview-panel">
        <div className="overline mb-3 flex items-center gap-2 text-neutral-400">
          <Braces className="h-3 w-3" strokeWidth={1.5} />
          spec.json preview
        </div>
        <pre className="terminal-green font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
          {jsonPreview}
        </pre>
        <div className="mt-6 border-t border-neutral-800 pt-4">
          <div className="overline mb-2 text-neutral-500">what happens next</div>
          <ol className="space-y-1 font-mono text-[11px] text-neutral-300">
            <li>1. agent loads local hf model</li>
            <li>2. generates plan + code</li>
            <li>3. launches app + runs playwright</li>
            <li>4. opencv watches desktop continuously</li>
            <li>5. diagnoses & self-repairs on failure</li>
            <li>6. repeats until acceptance or cap</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
