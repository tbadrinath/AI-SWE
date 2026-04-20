import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Models from "./pages/Models";
import TaskBuilder from "./pages/TaskBuilder";
import Runs from "./pages/Runs";
import RunDetail from "./pages/RunDetail";
import Phases from "./pages/Phases";
import DownloadPage from "./pages/Download";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/models" element={<Models />} />
            <Route path="/tasks" element={<TaskBuilder />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/runs/:runId" element={<RunDetail />} />
            <Route path="/phases" element={<Phases />} />
            <Route path="/download" element={<DownloadPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
