"use client";

import { motion } from "motion/react";

/* Each Invoicing section fades and rises in on navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="stl-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
