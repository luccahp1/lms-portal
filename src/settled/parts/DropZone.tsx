"use client";

import { motion } from "motion/react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";

/** Drag a CSV here or pick one. Calls onFile with the file; the caller uploads it. */
export function DropZone({ onFile, busy, title = "Drop a CSV here", hint, accept = ".csv,text/csv" }: { onFile: (f: File) => void; busy?: boolean; title?: string; hint?: string; accept?: string }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <motion.label
      htmlFor={id}
      className={"drop" + (over ? " over" : "") + (busy ? " busy" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      animate={{ scale: over ? 1.01 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        disabled={busy}
      />
      <motion.span className="drop-ico" animate={over ? { y: -4 } : { y: 0 }}>
        {busy ? <FileSpreadsheet className="drop-pulse" /> : <UploadCloud />}
      </motion.span>
      <span className="bold">{busy ? "Reading it…" : title}</span>
      <span className="small faint">{hint ?? "or click to choose a file"}</span>
    </motion.label>
  );
}
