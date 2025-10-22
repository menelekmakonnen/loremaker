import React from "react";

/**
 * A simple input component that wraps a native <input>. It applies
 * TailwindCSS classes for consistent styling across the app. It supports
 * forwarding refs and any other standard input props.
 */
export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-zinc-700 bg-zinc-800 p-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${className}`}
      {...props}
    />
  );
}
