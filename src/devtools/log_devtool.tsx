import React from 'react';
import { createRoot } from "react-dom/client";
import { LogViewerComponent } from '../components/log-viewer';

const root = createRoot(document.getElementById("log_devtool_root")!);

root.render(
  <React.StrictMode>
    <LogViewerComponent />
  </React.StrictMode>
);
