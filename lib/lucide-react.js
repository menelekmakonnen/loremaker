import React from "react";

/*
 * This file provides placeholder implementations for icons used from the
 * `lucide-react` library. Each exported icon is a simple SVG element
 * representing a square with a diagonal line, making it clear where the
 * icon would render. When you wish to use the real icons, install
 * lucide-react and remove this stub; module resolution will take care of
 * using the correct package.
 */

function createIcon(name) {
  return function Icon({ size = 24, className = "", color = "currentColor", ...props }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="3" x2="21" y2="21" />
      </svg>
    );
  };
}

// Define each icon used in the Loremaker component. They all point to the
// same placeholder implementation for now. If you need to add more icons
// later, import them here and export them similarly.
export const Search = createIcon("Search");
export const RefreshCcw = createIcon("RefreshCcw");
export const X = createIcon("X");
export const ArrowUp = createIcon("ArrowUp");
export const ArrowRight = createIcon("ArrowRight");
export const ChevronLeft = createIcon("ChevronLeft");
export const ChevronRight = createIcon("ChevronRight");
export const Filter = createIcon("Filter");
export const Users = createIcon("Users");
export const MapPin = createIcon("MapPin");
export const Layers3 = createIcon("Layers3");
export const Atom = createIcon("Atom");
export const Clock = createIcon("Clock");
export const LibraryBig = createIcon("LibraryBig");
export const Crown = createIcon("Crown");
export const Swords = createIcon("Swords");
export const ArrowDown = createIcon("ArrowDown");
