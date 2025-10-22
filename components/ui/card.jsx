import React from "react";

/**
 * Card component composition. Cards are lightweight containers with
 * optional header, content and footer sections. You can compose them by
 * nesting <CardHeader>, <CardContent> and <CardFooter> inside <Card>.
 */
export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-50 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`border-b border-zinc-700 p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 className={`text-lg font-semibold ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p className={`text-sm text-zinc-400 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div className={`border-t border-zinc-700 p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
