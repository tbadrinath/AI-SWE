import React from "react";
import { endpoints } from "../lib/api";
import { Download, FileCode, Package, Terminal as TerminalIcon } from "lucide-react";

const FILE_TREE = [
  { p: "agentic-builder-phase1/", d: "" },
  { p: "├── README.md", d: "setup & usage" },
  { p: "├── main.py", d: "entrypoint — scan + select + run" },
  { p: "├── config.py", d: "thresholds & paths" },
  { p: "├── orchestrator.py", d: "perceive → act → test → fix loop" },
  { p: "├── models/", d: "" },
  { p: "│   ├── scanner.py", d: "scan_cache_dir() over HF cache" },
  { p: "│   ├── registry.py", d: "capability inference" },
  { p: "│   ├── selector.py", d: "scoring + auto-pick" },
  { p: "│   └── loader.py", d: "local_files_only=True loader" },
  { p: "└── tools/", d: "" },
  { p: "    ├── editor.py", d: "read/write_file" },
  { p: "    ├── terminal.py", d: "subprocess runner" },
  { p: "    ├── browser_session.py", d: "Playwright wrapper" },
  { p: "    ├── actions.py", d: "click / type / wait" },
  { p: "    ├── tester.py", d: "deterministic checks" },
  { p: "    ├── observer.py", d: "diagnosis synthesizer" },
  { p: "    └── vision.py", d: "OpenCV continuous perception" },
];

export default function DownloadPage() {
  return (
    <div className="space-y-6" data-testid="download-root">
      <div className="grid grid-cols-1 border border-neutral-900 md:grid-cols-3">
        <div className="col-span-2 p-8 md:border-r md:border-neutral-900">
          <div className="overline">Phase 1 Agent</div>
          <h2 className="mt-2 font-heading text-3xl font-black tracking-tight md:text-4xl">
            Run the autonomous agent on your own machine.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-neutral-700 leading-relaxed">
            Download the full Phase 1 source. It auto-scans your local Hugging Face cache
            (<span className="font-mono">~/.cache/huggingface/hub</span>), selects the best
            coding model, launches your project, watches the desktop continuously with
            OpenCV, tests via Playwright, and self-repairs on failure.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={endpoints.downloadPhase1Url}
              download
              data-testid="download-zip-btn"
              className="inline-flex items-center gap-2 border border-neutral-900 bg-[var(--ab-klein-blue)] px-5 py-3 text-sm font-medium text-white hover:bg-[#001e6e]"
            >
              <Download className="h-4 w-4" />
              Download phase1.zip
            </a>
            <span className="inline-flex items-center gap-2 border border-neutral-900 bg-white px-5 py-3 text-sm font-mono">
              <Package className="h-4 w-4" strokeWidth={1.5} />
              ~16 KB · MIT-style
            </span>
          </div>
        </div>

        <div className="bg-[var(--ab-terminal-bg)] p-8" data-testid="install-snippet">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              quickstart
            </span>
          </div>
          <pre className="mt-4 font-mono text-[12px] leading-relaxed terminal-green whitespace-pre-wrap">
{`$ unzip phase1.zip && cd agentic-builder-phase1
$ pip install transformers huggingface_hub \\
      accelerate torch playwright \\
      opencv-python mss numpy pillow rich
$ playwright install
$ python main.py

> Using local HF model: Qwen/Qwen2.5-Coder-7B-Instruct
> === Attempt 1 ===
> perception streaming @ 6 FPS
> test FAIL — expected 'Hello' not visible
> === Attempt 2 ===
> test PASS — SUCCESS`}
          </pre>
        </div>
      </div>

      <div className="grid grid-cols-1 border border-neutral-900 md:grid-cols-3">
        <div className="col-span-2 p-8 md:border-r md:border-neutral-900" data-testid="file-tree">
          <div className="overline mb-3 flex items-center gap-2">
            <FileCode className="h-3 w-3" strokeWidth={1.5} />
            structure
          </div>
          <div className="font-mono text-[12px]">
            {FILE_TREE.map((row, i) => (
              <div key={i} className="flex items-center justify-between border-b border-dashed border-neutral-200 py-1.5">
                <span className="whitespace-pre text-neutral-900">{row.p}</span>
                <span className="text-neutral-500">{row.d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">
          <div className="overline mb-3">requires</div>
          <ul className="space-y-2 font-mono text-[12px]">
            <li>· local Hugging Face model cache</li>
            <li>· GPU strongly recommended</li>
            <li>· Python 3.10+</li>
            <li>· macOS / Linux / Windows</li>
            <li>· display (for OpenCV screen capture)</li>
          </ul>

          <div className="overline mb-3 mt-6">not included (yet)</div>
          <ul className="space-y-2 font-mono text-[12px] text-neutral-500">
            <li>· Phase 2 VLM region reasoning</li>
            <li>· Phase 3 Appium / Android</li>
            <li>· Phase 4 multi-agent router</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
