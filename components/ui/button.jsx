import React from "react";

/**
 * A simple button component used throughout the Loremaker demo. This wraps a
 * native <button> element with some sensible default classes from
 * TailwindCSS. The `variant` prop can be used to choose between a filled
 * (default) or outlined style. All other props are forwarded to the
 * underlying button element.
 */
export function Button({ className = "", variant = "default", size = "md", children, ...props }) {
  const base =
    variant === "outline"
      ? "border border-zinc-600 bg-transparent hover:bg-zinc-800"
      : "bg-zinc-700 hover:bg-zinc-600";
  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium text-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 ${base} ${sizes[size] ?? sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
