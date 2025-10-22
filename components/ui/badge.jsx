import React from "react";

/**
 * Badge component. Displays a small pill used to highlight information.
 */
export function Badge({ className = "", children, ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-50 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
