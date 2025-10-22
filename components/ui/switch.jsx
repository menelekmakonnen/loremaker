import React from "react";

/**
 * A simple toggle switch built with an input of type checkbox. You can
 * control its state via the `checked` prop and receive changes via
 * `onCheckedChange`. Styling is done with Tailwind to approximate a
 * modern switch. If you need accessibility or animations, consider
 * replacing this with a component from a UI library.
 */
export function Switch({ checked = false, onCheckedChange = () => {}, className = "", ...props }) {
  return (
    <label className={"inline-flex items-center cursor-pointer " + className}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        {...props}
      />
      <div className="relative h-5 w-10 rounded-full bg-zinc-700 peer-checked:bg-zinc-500 transition-colors">
        <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-zinc-50 transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
