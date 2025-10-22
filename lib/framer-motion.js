import React from "react";

/*
 * This module stubs the popular `framer-motion` API to allow our app to
 * compile without the heavy dependency. It exposes the same identifiers as
 * the real package but implements them as no‑ops or identity functions. If
 * you later decide to use the real library, simply install it and remove
 * this file; the module alias in jsconfig.json will cause the real module
 * to be used instead.
 */

// A Proxy that returns a functional component for any requested element.
export const motion = new Proxy(
  {},
  {
    get(target, key) {
      return ({ children, ...props }) => React.createElement(key, props, children);
    },
  }
);

// Motion value hook returns the initial value directly.
export function useMotionValue(initial) {
  return initial;
}

// Spring simply returns the input value without animation.
export function useSpring(value, _config) {
  return value;
}

// Transform returns the value as is. In a real implementation this would
// derive new values based on input ranges and output ranges.
export function useTransform(value, _inputRange, _outputRange) {
  return value;
}
