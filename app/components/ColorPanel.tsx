import React, { useRef } from "react";
import { useAtom } from "jotai";
import { colorState } from "../utils/state";
import { RgbaColorPicker } from "react-colorful";

const ColorPanel = () => {
  const [color, setColor] = useAtom(colorState);
  const popupWinRef = useRef<HTMLDivElement>(null);

  return (
    <button
      popoverTarget="ColModal"
      className="m-3 text-center rounded-md p-2 cursor-pointer font-bold bg-slate-400"
      style={{
        backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
        color: color.r + color.b + color.g <= 300 ? "white" : "black",
      }}
    >
      Color
      <div
        popover="manual"
        id="ColModal"
        className="h-fit w-fit p-3 ml-3 border-2 border-slate-300 rounded-lg bg-slate-100 absolute top-[10px] left-[700px]"
        ref={popupWinRef}
      >
        <RgbaColorPicker color={color} onChange={setColor} />
      </div>
    </button>
  );
};

export default ColorPanel;
