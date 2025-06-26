import React from "react";
import ToolPanel_icon from "./ToolPanel_icon";

const ToolPanel = () => {
  return (
    <div className="overflow-hidden flex w-fit h-[70px] border-2 border-slate-300 rounded-lg bg-slate-100">
      <ToolPanel_icon label="Draw" tool_name="描画" />
      <ToolPanel_icon label="Eraser" tool_name="消しゴム" />
      <ToolPanel_icon label="Move" tool_name="移動" />
      <ToolPanel_icon label="Rotation" tool_name="回転" />
      <ToolPanel_icon label="Zoom" tool_name="拡大縮小" />
    </div>
  );
};

export default ToolPanel;
