"use client";

// The kit's browser side: motion on each page, the theme toggle, the phone drawer.
import "@/kit/charts.js";
import "@/kit/motion.js";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KitIcon } from "./kit";

type Motion = { reveal: (root?: Element | Document) => void; settle: (root?: Element | Document) => void };
const motion = () => (globalThis as unknown as { LMSMotion?: Motion }).LMSMotion;

/** Animates each page in once when it is opened. Live refreshes keep the DOM, so they don't replay it. */
export function KitMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const main = document.getElementById("main");
    if (main) motion()?.reveal(main);
  }, [pathname]);
  return null;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    // On londonmarketingsolutions.ca the choice is shared with LMS Dash.
    const shared = /(^|\.)londonmarketingsolutions\.ca$/.test(location.hostname) ? "; domain=.londonmarketingsolutions.ca" : "";
    document.cookie = `lms_look=${next}; path=/; max-age=31536000; samesite=lax${shared}`;
    setDark(!dark);
  };
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="k-iconbtn" onClick={flip} aria-label={label} title={label}>
      <KitIcon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/** The menu button and the drawer state for the left nav on phones. */
export function MenuButton() {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById("side")?.classList.remove("is-open");
    document.getElementById("scrim")?.classList.remove("is-open");
  }, [pathname]);
  const open = () => {
    document.getElementById("side")?.classList.add("is-open");
    document.getElementById("scrim")?.classList.add("is-open");
  };
  return (
    <button type="button" className="k-iconbtn k-menu" onClick={open} aria-label="Open menu" aria-controls="side">
      <KitIcon name="menu" />
    </button>
  );
}

export function Scrim() {
  const close = () => {
    document.getElementById("side")?.classList.remove("is-open");
    document.getElementById("scrim")?.classList.remove("is-open");
  };
  return <div className="k-scrim" id="scrim" onClick={close} />;
}
