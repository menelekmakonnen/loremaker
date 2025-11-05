import React, { useEffect, useMemo, useState } from "react";

function combineClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseDriveSource(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const searchId = parsed.searchParams.get("id");
    const resourceKey = parsed.searchParams.get("resourcekey") || undefined;
    let id = null;

    if (/drive\.google\.(com|co)/.test(host)) {
      const match = parsed.pathname.match(/\/d\/([^/]+)/);
      if (match?.[1]) {
        id = match[1];
      } else if (parsed.pathname.startsWith("/thumbnail")) {
        id = searchId;
      } else if (parsed.pathname.startsWith("/uc") || parsed.pathname.startsWith("/open")) {
        id = searchId;
      } else if (searchId) {
        id = searchId;
      }
    } else if (/googleusercontent\.com$/.test(host) || /googleusercontent\.com$/.test(host.replace(/^lh\d+\./, ""))) {
      const match = parsed.pathname.match(/\/d\/([^/=]+)/);
      if (match?.[1]) {
        id = match[1];
      } else if (searchId) {
        id = searchId;
      } else {
        const segment = parsed.pathname.split("/").pop() || "";
        const clean = segment.split("=")[0];
        if (clean && clean.length > 10) id = clean;
      }
    }

    if (!id) return null;
    return { id, resourceKey };
  } catch {
    return null;
  }
}

function driveImageCandidates(url) {
  const source = parseDriveSource(url);
  if (!source) return [];
  const { id, resourceKey } = source;
  const resourceQuery = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : "";
  const resourceSuffix = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : "";

  return unique([
    `https://lh3.googleusercontent.com/d/${id}=w1400-h1400-no`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=w1400-h1400-no${resourceSuffix}` : null,
    `https://lh3.googleusercontent.com/d/${id}=w2000-h2000-no`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=w2000-h2000-no${resourceSuffix}` : null,
    `https://lh3.googleusercontent.com/d/${id}=s1600`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=s1600${resourceSuffix}` : null,
    `https://lh3.googleusercontent.com/d/${id}=s2048`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=s2048${resourceSuffix}` : null,
    `https://drive.googleusercontent.com/uc?export=view&id=${id}${resourceQuery}`,
    `https://drive.google.com/uc?export=view&id=${id}${resourceQuery}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600${resourceQuery}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000${resourceQuery}`,
    url,
  ]);
}

export function imageCandidates(src) {
  if (!src) return [];
  const trimmed = typeof src === "string" ? src.trim() : src;
  if (!trimmed) return [];
  const drive = driveImageCandidates(trimmed);
  if (drive.length) return drive;
  return unique([trimmed]);
}

export function Insignia({ label, size = 48 }) {
  const fallback = label || "Lore";
  const initials = fallback
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "LM";
  const hue = Math.abs([...fallback].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const topWidth = 32;
  const fillOne = `hsl(${hue}, 85%, 64%)`;
  const fillTwo = `hsl(${(hue + 48) % 360}, 80%, 60%)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="drop-shadow-[0_3px_12px_rgba(0,0,0,0.55)]">
      <defs>
        <linearGradient id={`ins-${hue}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={fillOne} />
          <stop offset="100%" stopColor={fillTwo} />
        </linearGradient>
      </defs>
      <path
        d={`M32 6 C32 6 ${32 - topWidth / 2} 10 ${32 - topWidth / 2} 10 L ${32 + topWidth / 2} 10 C ${32 + topWidth / 2} 10 32 6 32 6 L 56 16 L 56 36 C 56 47 46 57 32 60 C 18 57 8 47 8 36 L 8 16 Z`}
        fill={`url(#ins-${hue})`}
        stroke="rgba(255,255,255,.45)"
        strokeWidth="1.4"
      />
      <text
        x="32"
        y="39"
        textAnchor="middle"
        fontFamily="var(--font-sans, 'Inter', 'Segoe UI', sans-serif)"
        fontWeight="900"
        fontSize="20"
        fill="#fff"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}
      >
        {initials}
      </text>
    </svg>
  );
}

export function characterAltText(name) {
  const label = name && String(name).trim().length ? String(name).trim() : "LoreMaker Legend";
  return `${label} | Loremaker Universe | Menelek Makonnen`;
}

function ImageSafe({
  src,
  alt,
  className = "",
  fallbackLabel,
  loading = "lazy",
  decoding = "async",
  ...rest
}) {
  const sources = useMemo(() => imageCandidates(src), [src]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [sources]);

  const current = sources[index];

  const handleError = () => {
    if (index < sources.length - 1) {
      setIndex((value) => value + 1);
    } else {
      setFailed(true);
    }
  };

  if (!current || failed) {
    return (
      <div className={combineClasses("flex items-center justify-center rounded-2xl border border-white/15 bg-white/10", className)}>
        <Insignia label={fallbackLabel} size={64} />
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      onError={handleError}
      onLoad={() => setFailed(false)}
      className={className}
      loading={loading}
      decoding={decoding}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      {...rest}
    />
  );
}

export default ImageSafe;
