"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spring } from "@/settled/ui/motion";
import { stlLayer } from "@/settled/ui/ui";

type Kind = "good" | "bad" | "info";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
  action?: { label: string; run: () => void };
}

interface Api {
  good: (text: string, action?: Toast["action"]) => void;
  bad: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<Api | null>(null);

export function useToast(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("ToastProvider missing");
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((kind: Kind, text: string, action?: Toast["action"]) => {
    const id = ++n.current;
    setItems((xs) => [...xs.slice(-2), { id, kind, text, action }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "bad" ? 6000 : 3800);
  }, []);
  const api = useMemo<Api>(
    () => ({ good: (t, a) => push("good", t, a), bad: (t) => push("bad", t), info: (t) => push("info", t) }),
    [push],
  );
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useEffect(() => setLayer(stlLayer()), []);
  const list = (
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.16 } }}
              transition={spring}
            >
              {t.kind === "good" ? <CircleCheck className="t-good" /> : t.kind === "bad" ? <CircleAlert className="t-bad" /> : <Info />}
              <span>{t.text}</span>
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.run();
                    setItems((xs) => xs.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      {layer ? createPortal(list, layer) : null}
    </Ctx.Provider>
  );
}
