"use client";

// Import global styles for TailwindCSS
import "./globals.css";

// Import the pre-built Loremaker component. This file is a self‑contained
// React module that implements the entire Loremaker experience. By
// separating it into the `components` directory we avoid having to
// modify the original file beyond integrating it with Next.js.
import LoremakerPage from "../components/Loremaker";

// Next.js expects a default export for `app/page.jsx`. We simply
// render the imported component here. Because the component uses
// hooks such as `useState` and `useEffect`, this file marks itself
// as a client component via the `"use client"` directive.
export default function Page() {
  return <LoremakerPage />;
}
