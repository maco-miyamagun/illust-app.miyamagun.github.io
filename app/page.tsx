"use client";

import ToolPanel from "./components/ToolPanel";
import PixelCanvas from "./components/PixelCanvas";
import ColorPanel from "./components/ColorPanel";

function App() {
  return (
    <main className="bg-gray-200 p-3">
      <div className="flex m-3">
        <ToolPanel />
        <ColorPanel />
      </div>

      <PixelCanvas />
    </main>
  );
}

export default App;
