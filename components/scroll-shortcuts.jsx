import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";

export default function ScrollShortcuts() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      setShowTop(scrollTop > 240);
      setShowBottom(scrollTop + clientHeight < scrollHeight - 240);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showTop && (
          <motion.button
            key="scroll-top"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            whileHover={{ scale: 1.08, rotate: [-2, 2, 0] }}
            whileTap={{ scale: 0.92, rotate: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-5 right-5 z-40 rounded-full border border-amber-300/60 bg-black/80 p-3 text-white shadow-xl"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBottom && (
          <motion.button
            key="scroll-bottom"
            type="button"
            onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            whileHover={{ scale: 1.08, rotate: [2, -2, 0] }}
            whileTap={{ scale: 0.92, rotate: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-5 right-20 z-40 rounded-full border border-white/30 bg-black/80 p-3 text-white shadow-xl"
            aria-label="Skip to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
