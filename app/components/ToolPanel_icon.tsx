import React from "react";
import { selectedToolState } from "../utils/state";
import { useAtom } from "jotai";

type Props = {
  label: Tools;
  tool_name: string;
};

const ToolPanel_icon = (props: Props) => {
  const [selectedTool, setSelectedTool] = useAtom(selectedToolState);

  return (
    <div
      onClick={() => {
        setSelectedTool(props.label);
      }}
      key={props.label}
      className={`${
        props.label == selectedTool ? "bg-blue-300" : "bg-none"
      } m-3 text-center rounded-md p-2 cursor-pointer font-extrabold`}
    >
      {props.tool_name}
    </div>
  );
};

export default ToolPanel_icon;
