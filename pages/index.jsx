import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  useLayoutEffect,
} from "react";
import Head from "next/head";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Search,
  RefreshCcw,
  X,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Users,
  MapPin,
  Layers,
  Atom,
  Clock,
  Library,
  Crown,
  Swords,
  Sparkles,
  ShieldCheck,
  HeartPulse,
  Skull,
  Circle,
} from "lucide-react";
import {
  computeFeatured,
  normaliseArray,
  fetchCharactersFromSheets,
  todayKey,
  publicCharactersError,
  seededRandom,
} from "../lib/characters";

/**
 * Ultra interactive Loremaker experience
 * - Loads characters from Google Sheets (GViz)
 * - Daily seeded hero carousel + power seeding
 * - Sliding filters drawer, animated arena, immersive UI components
 */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function unique(values) {
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
    `https://lh3.googleusercontent.com/d/${id}=w2000-h2000-no`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=w2000-h2000-no${resourceSuffix}` : null,
    `https://lh3.googleusercontent.com/d/${id}=s2048`,
    resourceKey ? `https://lh3.googleusercontent.com/d/${id}=s2048${resourceSuffix}` : null,
    `https://drive.googleusercontent.com/uc?export=view&id=${id}${resourceQuery}`,
    `https://drive.google.com/uc?export=view&id=${id}${resourceQuery}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000${resourceQuery}`,
    url,
  ]);
}

function imageCandidates(src) {
  if (!src) return [];
  const trimmed = typeof src === "string" ? src.trim() : src;
  if (!trimmed) return [];
  const drive = driveImageCandidates(trimmed);
  if (drive.length) return drive;
  return unique([trimmed]);
}

const STATUS_PRESETS = [
  { test: /active|alive/i, label: "Active", dot: "bg-emerald-400", ring: "ring-emerald-400/60", icon: ShieldCheck },
  { test: /deceased|dead|fallen/i, label: "Fallen", dot: "bg-rose-400", ring: "ring-rose-400/60", icon: Skull },
  { test: /missing|unknown|undisclosed/i, label: "Unknown", dot: "bg-indigo-300", ring: "ring-indigo-300/60", icon: Circle },
  { test: /retired|dormant|inactive/i, label: "Dormant", dot: "bg-amber-300", ring: "ring-amber-300/60", icon: HeartPulse },
];

function statusVisual(status) {
  if (!status) return null;
  const preset = STATUS_PRESETS.find((entry) => entry.test.test(status));
  if (!preset) return null;
  return preset;
}

function Button({ variant = "solid", size = "md", className = "", children, as: Tag = "button", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 font-extrabold rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };
  const variants = {
    solid: "bg-white text-black hover:bg-white/90",
    subtle: "bg-white/10 text-white hover:bg-white/20 border border-white/20",
    ghost: "text-white/80 hover:bg-white/10",
    gradient: "bg-gradient-to-r from-amber-400 via-fuchsia-400 to-indigo-500 text-black shadow-lg hover:brightness-110",
    destructive: "bg-red-600 text-white hover:bg-red-500",
    outline: "border border-white/40 text-white hover:bg-white/10",
    dark: "bg-black/70 text-white hover:bg-black",
  };
  return (
    <Tag className={cx(base, sizes[size], variants[variant] || variants.solid, className)} {...props}>
      {children}
    </Tag>
  );
}

function Card({ className = "", children }) {
  return <div className={cx("rounded-3xl border border-white/12 bg-white/8 backdrop-blur-2xl shadow-[0_25px_80px_rgba(8,8,20,0.55)]", className)}>{children}</div>;
}
const CardHeader = ({ className = "", children }) => <div className={cx("p-5", className)}>{children}</div>;
const CardContent = ({ className = "", children }) => <div className={cx("p-5", className)}>{children}</div>;
const CardFooter = ({ className = "", children }) => <div className={cx("px-5 pb-5", className)}>{children}</div>;
const CardTitle = ({ className = "", children }) => <div className={cx("text-lg font-black", className)}>{children}</div>;
const CardDescription = ({ className = "", children }) => <div className={cx("text-sm text-white/75", className)}>{children}</div>;

const Input = React.forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white placeholder-white/50 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
        className
      )}
      {...props}
    />
  );
});

const Badge = ({ className = "", children }) => (
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide", className)}>{children}</span>
);

const Switch = ({ checked, onCheckedChange }) => (
  <button
    type="button"
    onClick={() => onCheckedChange(!checked)}
    role="switch"
    aria-checked={checked}
    className={cx(
      "relative h-7 w-12 rounded-full border transition",
      checked ? "border-amber-300 bg-amber-300/70" : "border-white/30 bg-white/12"
    )}
  >
    <span
      className={cx(
        "absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-all",
        checked ? "translate-x-5 shadow-lg" : "translate-x-0"
      )}
    />
  </button>
);

function useMediaQuery(query) {
  const getMatch = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);
  const [matches, setMatches] = useState(getMatch);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}


function getCharacterValues(character, key) {
  switch (key) {
    case "gender":
    case "alignment":
    case "status":
    case "era":
      return normaliseArray(character[key]);
    case "locations":
      return normaliseArray(character.locations);
    case "faction":
      return normaliseArray(character.faction);
    case "tags":
      return normaliseArray(character.tags);
    case "stories":
      return normaliseArray(character.stories);
    case "powers":
      return normaliseArray((character.powers || []).map((power) => power.name));
    case "alias":
    case "aliases":
      return normaliseArray(character.alias);
    case "id":
    case "name":
      return normaliseArray(character[key]);
    default:
      return normaliseArray(character[key]);
  }
}

function matchesFilters(character, filters = {}, combineAND = false, query = "") {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length) {
    const searchable = [
      character.id,
      character.name,
      character.gender,
      character.alignment,
      character.status,
      character.era,
      (character.alias || []).join(" "),
      (character.locations || []).join(" "),
      (character.faction || []).join(" "),
      (character.tags || []).join(" "),
      (character.stories || []).join(" "),
      (character.powers || []).map((power) => power.name).join(" "),
      character.shortDesc,
      character.longDesc,
    ]
      .filter(Boolean)
      .join(" \n ")
      .toLowerCase();

    const queryMatch = terms.every((term) => searchable.includes(term));
    if (!queryMatch) {
      return false;
    }
  }

  if (!filters || !Object.keys(filters).length) return true;

  const entries = Object.entries(filters).filter(([, value]) => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  });

  if (!entries.length) return true;

  return entries.every(([key, selected]) => {
    const desired = normaliseArray(selected).map((value) => String(value).toLowerCase());
    if (!desired.length) return true;

    const available = getCharacterValues(character, key).map((value) => String(value).toLowerCase());
    if (!available.length) return false;

    const comparator = combineAND ? "every" : "some";
    return desired[comparator]((needle) => available.includes(needle));
  });
}

function useCharacters(initialData = [], initialError = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData.length && !initialError);
  const [error, setError] = useState(initialError);

  const fetchLatest = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/characters${force ? "?force=1" : ""}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      const payload = await res.json();
      setData(payload.data || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(publicCharactersError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(initialData);
    setError(initialError ? publicCharactersError(initialError) : null);
    setLoading(false);
  }, [initialData, initialError]);

  useEffect(() => {
    if (!initialData.length && !initialError) {
      fetchLatest();
    }
  }, [fetchLatest, initialData.length, initialError]);

  return { data, loading, error, refetch: () => fetchLatest(true) };
}

function Aurora({ className = "" }) {
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { stiffness: 60, damping: 20 });
  const sy = useSpring(y, { stiffness: 60, damping: 20 });
  const left = useTransform(sx, (value) => `${value}%`);
  const top = useTransform(sy, (value) => `${value}%`);
  return (
    <motion.div
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(((event.clientX - rect.left) / rect.width) * 100);
        y.set(((event.clientY - rect.top) / rect.height) * 100);
      }}
      className={cx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <motion.div style={{ left, top }} className="absolute h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-700/40 via-fuchsia-500/35 to-amber-400/40" />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_65%)]" />
    </motion.div>
  );
}

function CosmicBackdrop() {
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: `star-${index}`,
        size: Math.random() * 2.2 + 0.8,
        top: Math.random() * 100,
        left: Math.random() * 100,
        delay: Math.random() * 6,
      })),
    []
  );
  const nebulas = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        id: `nebula-${index}`,
        size: Math.random() * 60 + 40,
        top: Math.random() * 100,
        left: Math.random() * 100,
        hue: Math.floor(Math.random() * 360),
        duration: Math.random() * 18 + 18,
      })),
    []
  );
  const comets = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => ({
        id: `comet-${index}`,
        top: Math.random() * 100,
        delay: index * 8,
      })),
    []
  );
  const planets = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => ({
        id: `planet-${index}`,
        size: Math.random() * 18 + 12,
        top: Math.random() * 100,
        left: Math.random() * 100,
        hue: Math.floor(Math.random() * 360),
        duration: 16 + Math.random() * 12,
      })),
    []
  );
  const vortices = useMemo(
    () =>
      Array.from({ length: 2 }, (_, index) => ({
        id: `vortex-${index}`,
        size: Math.random() * 14 + 10,
        top: Math.random() * 100,
        left: Math.random() * 100,
        duration: 20 + Math.random() * 12,
      })),
    []
  );
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      const { innerWidth, innerHeight } = window;
      setPointer({ x: event.clientX / innerWidth, y: event.clientY / innerHeight });
    };
    window.addEventListener("pointermove", handler, { passive: true });
    return () => window.removeEventListener("pointermove", handler);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-30 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(26,32,68,0.85),#050611_65%)]" />
      {nebulas.map((nebula) => (
        <motion.span
          key={nebula.id}
          className="absolute rounded-full blur-3xl"
          style={{
            width: `${nebula.size}vmin`,
            height: `${nebula.size}vmin`,
            top: `${nebula.top}%`,
            left: `${nebula.left}%`,
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), hsla(${nebula.hue},80%,60%,0.22), transparent 70%)`,
          }}
          animate={{ opacity: [0.25, 0.55, 0.2], scale: [1, 1.06, 0.98] }}
          transition={{ duration: nebula.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="absolute rounded-full bg-white/90"
          style={{
            width: `${star.size}px`,
            height: `${star.size}px`,
            top: `${star.top}%`,
            left: `${star.left}%`,
          }}
          animate={() => {
            const dx = pointer.x * 100 - star.left;
            const dy = pointer.y * 100 - star.top;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const proximity = Math.max(0, 1 - distance / 26);
            return {
              opacity: [0.1, 0.22 + proximity * 0.75, 0.12],
              scale: [1, 1.18 + proximity * 0.45, 1],
              boxShadow: [
                "0 0 6px rgba(255,255,255,0.15)",
                `0 0 ${10 + proximity * 22}px rgba(255,255,255,${0.25 + proximity * 0.6})`,
                "0 0 6px rgba(255,255,255,0.12)",
              ],
            };
          }}
          transition={{ duration: 3.8, delay: star.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {planets.map((planet) => (
        <motion.div
          key={planet.id}
          className="absolute rounded-full"
          style={{
            width: `${planet.size}vmin`,
            height: `${planet.size}vmin`,
            top: `${planet.top}%`,
            left: `${planet.left}%`,
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), hsla(${planet.hue},85%,65%,0.45) 35%, rgba(4,6,15,0.1) 70%)`,
            mixBlendMode: "screen",
          }}
          animate={{
            opacity: [0.06, 0.22, 0.1],
            rotate: [0, 5, -4, 0],
          }}
          transition={{ duration: planet.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {vortices.map((vortex) => (
        <motion.div
          key={vortex.id}
          className="absolute rounded-full"
          style={{
            width: `${vortex.size}vmin`,
            height: `${vortex.size}vmin`,
            top: `${vortex.top}%`,
            left: `${vortex.left}%`,
            background:
              "radial-gradient(circle, rgba(5,8,19,0.95) 0%, rgba(30,41,78,0.6) 35%, rgba(10,14,28,0.1) 70%)",
            boxShadow: "0 0 45px rgba(45,56,121,0.35)",
            mixBlendMode: "plus-lighter",
          }}
          animate={{
            rotate: [0, 180, 360],
            scale: [1, 1.08, 0.96, 1],
            opacity: [0.4, 0.55, 0.35],
          }}
          transition={{ duration: vortex.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {comets.map((comet) => (
        <motion.span
          key={comet.id}
          className="absolute h-px w-48 bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent"
          style={{ top: `${comet.top}%` }}
          initial={{ x: "-20%", opacity: 0 }}
          animate={{ x: "120%", opacity: [0, 1, 0] }}
          transition={{ duration: 22, delay: comet.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function HeroHalo() {
  const rings = useMemo(
    () =>
      [
        { size: 120, top: "-15%", left: "-18%", duration: 44 },
        { size: 140, top: "55%", left: "-12%", duration: 52 },
        { size: 160, top: "-10%", left: "58%", duration: 48 },
        { size: 180, top: "50%", left: "62%", duration: 58 },
      ],
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {rings.map((ring, index) => (
        <motion.div
          key={`ring-${ring.size}-${index}`}
          className="absolute rounded-full border border-white/10"
          style={{
            width: `${ring.size}vmin`,
            height: `${ring.size}vmin`,
            top: ring.top,
            left: ring.left,
            mixBlendMode: "screen",
          }}
          animate={{ rotate: index % 2 === 0 ? 360 : -360, scale: [1, 1.03, 0.97, 1] }}
          transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
        />
      ))}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.35, 0.55, 0.3] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-[8%] rounded-full border border-amber-400/15" style={{ mixBlendMode: "screen" }} />
        <div className="absolute inset-[18%] rounded-full border border-fuchsia-400/10" style={{ mixBlendMode: "screen" }} />
      </motion.div>
    </div>
  );
}

function HeroDynamicBackground({ pointer, ripples }) {
  const palettes = useMemo(
    () => [
      ["rgba(254,240,199,0.95)", "rgba(249,200,255,0.72)", "rgba(120,166,255,0.6)", "rgba(9,13,34,0.92)"],
      ["rgba(255,224,189,0.95)", "rgba(255,153,227,0.7)", "rgba(158,206,255,0.6)", "rgba(15,20,46,0.92)"],
      ["rgba(236,233,255,0.92)", "rgba(198,215,255,0.75)", "rgba(255,182,222,0.55)", "rgba(12,14,36,0.92)"],
      ["rgba(244,229,255,0.92)", "rgba(255,189,200,0.7)", "rgba(142,196,255,0.58)", "rgba(10,14,33,0.92)"],
    ],
    []
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % palettes.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [palettes.length]);

  const stars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, starIndex) => ({
        id: `hero-star-${starIndex}`,
        size: Math.random() * 1.8 + 0.8,
        top: Math.random() * 100,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 3 + Math.random() * 4,
      })),
    []
  );

  const gradient = useMemo(() => {
    const palette = palettes[index] || palettes[0];
    return `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, ${palette[0]}, ${palette[1]} 40%, ${palette[2]} 70%, ${palette[3]})`;
  }, [index, palettes, pointer.x, pointer.y]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={`lux-gradient-${index}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
          style={{ background: gradient }}
        />
      </AnimatePresence>
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.14), transparent 60%), radial-gradient(ellipse at 80% 10%, rgba(255,255,255,0.1), transparent 55%), radial-gradient(ellipse at 50% 85%, rgba(255,255,255,0.08), transparent 65%)",
        }}
      />
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="absolute rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.75)]"
          style={{
            width: `${star.size}px`,
            height: `${star.size}px`,
            top: `${star.top}%`,
            left: `${star.left}%`,
          }}
          animate={{ opacity: [0.2, 0.95, 0.2], scale: [1, 1.35, 1] }}
          transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full border border-white/60"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0.65, scale: 0 }}
          animate={{ opacity: 0, scale: 5 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function RosterSlide({ slide, icon, facetKey, onFacet, onOpenCharacter, limit }) {
  const payload = slide.data;
  if (!payload?.name) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 rounded-[32px] border border-white/10 bg-white/6 p-8 text-white">
        <div className="text-xs font-bold tracking-[0.35em] text-white/70">{slide.label}</div>
        <p className="text-sm font-semibold text-white/70">Daily highlight synchronising…</p>
      </div>
    );
  }

  const members = payload.members || payload.residents || payload.wielders || [];
  const descriptor =
    slide.key === "faction"
      ? `Allies sworn to ${payload.name}`
      : slide.key === "location"
        ? `Key figures shaping ${payload.name}`
        : `Masters of ${payload.name}`;

  return (
    <div className="grid h-full gap-8 rounded-[32px] border border-white/15 bg-black/40 p-8 text-white lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-xs font-bold tracking-[0.35em] text-white/70">
          {icon}
          {slide.label}
        </div>
        <h3 className="text-2xl font-black leading-tight text-balance sm:text-4xl">{payload.name}</h3>
        <p className="text-sm font-semibold text-white/75">{descriptor}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="gradient"
            size="sm"
            onClick={() => {
              onFacet?.({ key: facetKey, value: payload.name });
            }}
            className="shadow-[0_10px_30px_rgba(250,204,21,0.25)]"
          >
            Filter by {payload.name}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {members.slice(0, limit).map((member) => (
          <button
            key={member.id || member.name}
            type="button"
            onClick={() => onOpenCharacter?.(member)}
            className="flex items-center gap-3 rounded-3xl border border-white/15 bg-white/10 p-3 text-left transition hover:bg-white/20"
          >
            <Insignia label={member.name} size={40} variant={slide.key === "faction" ? "faction" : "character"} />
            <div className="flex flex-col text-xs">
              <span className="text-sm font-black text-white">{member.name}</span>
              <span className="text-white/70">{member.alias?.[0] || member.shortDesc?.slice(0, 40) || "Open dossier"}</span>
            </div>
          </button>
        ))}
        {!members.length && (
          <div className="flex h-32 items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 text-xs font-semibold text-white/60">
            Awaiting intel on key figures.
          </div>
        )}
      </div>
    </div>
  );
}

function LoreShield({ size = 56, onClick }) {
  const idRef = useRef(() => `lore-${Math.random().toString(36).slice(2)}`);
  const gradientId = useMemo(() => idRef.current(), []);
  const generateAura = useCallback(() => {
    const hue = Math.floor(Math.random() * 360);
    return {
      hue,
      glow: 0.5 + Math.random() * 0.6,
      rotate: (Math.random() - 0.5) * 8,
      scale: 0.94 + Math.random() * 0.12,
      flare: 0.4 + Math.random() * 0.6,
      sheen: (hue + 60) % 360,
    };
  }, []);
  const [aura, setAura] = useState(() => generateAura());
  const sparks = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, index) => ({
        id: `spark-${index}`,
        delay: 0.6 + index * 0.35,
        x: (Math.random() - 0.5) * 26,
        y: (Math.random() - 0.5) * 32,
        scale: 0.5 + Math.random() * 0.9,
      })),
    []
  );

  useEffect(() => {
    const interval = setInterval(() => setAura(generateAura()), 2600);
    return () => clearInterval(interval);
  }, [generateAura]);

  const dramaticSurge = useCallback(() => {
    setAura((prev) => ({
      ...generateAura(),
      glow: prev.glow + 0.6,
      scale: prev.scale + 0.08,
    }));
  }, [generateAura]);

  const handleClick = (event) => {
    dramaticSurge();
    if (onClick) {
      onClick(event);
    } else {
      window.location.reload();
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onHoverStart={dramaticSurge}
      whileHover={{
        scale: aura.scale + 0.14,
        rotate: aura.rotate * 2,
        boxShadow: `0 0 45px rgba(255,255,255,${0.45 + aura.glow * 0.2})`,
        filter: "brightness(1.18) saturate(1.4)",
      }}
      whileTap={{
        scale: 0.9,
        rotate: -aura.rotate * 2,
        boxShadow: `0 0 60px rgba(255,255,255,0.85)`,
        filter: "contrast(1.2)",
      }}
      animate={{
        rotate: aura.rotate,
        scale: aura.scale,
        boxShadow: `0 0 ${24 + aura.glow * 26}px rgba(99,102,241,${0.35 + aura.glow * 0.25})`,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="relative inline-flex items-center justify-center overflow-visible rounded-[22px] border border-white/30 bg-black/40 p-2"
      aria-label="Reload Loremaker"
    >
      <svg width={size} height={size} viewBox="0 0 64 64" className="drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={`hsla(${aura.hue},88%,70%,0.85)`} />
            <stop offset="60%" stopColor={`hsla(${(aura.hue + 140) % 360},82%,65%,0.9)`} />
            <stop offset="100%" stopColor={`hsla(${aura.sheen},80%,72%,0.95)`} />
          </linearGradient>
          <radialGradient id={`${gradientId}-inner`} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="45%" stopColor={`hsla(${aura.hue},90%,80%,${0.45 + aura.flare * 0.3})`} />
            <stop offset="100%" stopColor="rgba(15,23,42,0.1)" />
          </radialGradient>
        </defs>
        <path
          d="M32 4 L8 16 L8 36 C8 49 19 58 32 61 C45 58 56 49 56 36 L56 16 Z"
          fill={`url(#${gradientId}-fill)`}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.4"
        />
        <path
          d="M32 11 L17 18 L17 34 C17 43 23 50 32 52 C41 50 47 43 47 34 L47 18 Z"
          fill={`url(#${gradientId}-inner)`}
        />
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontFamily="var(--font-sans, 'Inter', 'Segoe UI', sans-serif)"
          fontWeight="900"
          fontSize="16"
          fill="#0f172a"
          style={{ filter: "drop-shadow(0 1px 4px rgba(255,255,255,0.75))" }}
        >
          LORE
        </text>
      </svg>
      {sparks.map((spark) => (
        <motion.span
          key={spark.id}
          className="pointer-events-none absolute h-10 w-10 rounded-full bg-gradient-to-br from-amber-300/70 via-fuchsia-400/60 to-indigo-400/70 blur-md"
          style={{
            left: `calc(50% + ${spark.x}px)`,
            top: `calc(50% + ${spark.y}px)`,
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            opacity: [0.15, 0.65, 0.35, 0.2],
            scale: [spark.scale, spark.scale * 1.4, spark.scale * 0.9, spark.scale],
            rotate: [0, 15, -12, 0],
          }}
          transition={{ duration: 3.6, repeat: Infinity, delay: spark.delay, ease: "easeInOut" }}
        />
      ))}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        animate={{
          boxShadow: [
            "0 0 0 rgba(255,255,255,0)",
            `0 0 24px rgba(148,163,255,${0.2 + aura.glow * 0.2})`,
            "0 0 0 rgba(255,255,255,0)",
          ],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

function Insignia({ label, size = 48, variant = "character" }) {
  const fallback = label || "Lore";
  const initials = fallback
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "LM";
  const hue = Math.abs([...fallback].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const topWidth = variant === "site" ? 42 : variant === "faction" ? 36 : 32;
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

function ImageSafe({ src, alt, className = "", fallbackLabel }) {
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
      <div className={cx("flex items-center justify-center rounded-2xl border border-white/15 bg-white/10", className)}>
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
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      decoding="async"
    />
  );
}

function PowerMeter({ level, accent = "amber" }) {
  const pct = Math.min(100, Math.max(0, (Number(level) || 0) * 10));
  const gradient =
    accent === "emerald"
      ? "from-emerald-200 via-cyan-200 to-blue-300"
      : accent === "crimson"
      ? "from-rose-300 via-rose-400 to-red-500"
      : "from-amber-200 via-fuchsia-300 to-indigo-300";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-white/15"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Power level"
    >
      <div className={cx("h-full bg-gradient-to-r", gradient)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FacetChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition",
        active ? "border-white bg-white text-black" : "border-white/30 bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {children}
    </button>
  );
}

/** -------------------- Character Card / Modal -------------------- */
function StoryChips({ data, onFacet }) {
  const stories = useMemo(() => {
    const counts = new Map();
    for (const char of data) {
      (char.stories || []).forEach((story) => counts.set(story, (counts.get(story) || 0) + 1));
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([story]) => story);
  }, [data]);
  if (!stories.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {stories.map((story) => (
        <FacetChip key={story} onClick={() => onFacet({ key: "stories", value: story })}>
          {story}
        </FacetChip>
      ))}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "random", label: "Random" },
  { value: "faction", label: "By Faction" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
  { value: "most", label: "From Most Powerful" },
  { value: "least", label: "From Least Powerful" },
];

function CharacterCard({ char, onOpen, onFacet, onUseInSim, highlight }) {
  const [pulse, setPulse] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => {
    if (!highlight) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(timer);
  }, [highlight]);
  const triggerSim = () => {
    setPulse(true);
    const rect = cardRef.current?.getBoundingClientRect();
    onUseInSim(char, rect);
    setTimeout(() => setPulse(false), 700);
  };
  const quickFacts = [char.gender, char.status, char.alignment, char.era]
    .filter(Boolean)
    .slice(0, 3);
  const quickFilters = [
    ...(char.locations || []).slice(0, 2).map((value) => ({ key: "locations", value })),
    ...(char.faction || []).slice(0, 1).map((value) => ({ key: "faction", value })),
    ...(char.tags || []).slice(0, 1).map((value) => ({ key: "tags", value })),
  ];
  const highlightFacts = quickFacts.slice(0, 2);
  const minimalFilters = quickFilters.slice(0, 3);
  const description = char.shortDesc || char.longDesc || "No description yet.";
  const heroImage = useMemo(() => {
    const pool = [char.cover, ...(char.gallery || [])].filter(Boolean);
    if (!pool.length) return null;
    const rng = seededRandom(`${char.id || char.name || "card"}|grid`);
    const index = Math.floor(rng() * pool.length);
    return pool[index] || pool[0];
  }, [char.cover, char.gallery, char.id, char.name]);
  const accentLabel = (char.locations || [])[0] || char.era || char.status || "LoreMaker dossier";
  const shortCaption =
    description.length > 150 ? `${description.slice(0, 147).trimEnd()}…` : description;
  const primaryAlias = Array.isArray(char.alias) ? char.alias[0] : char.alias;
  const statusMeta = statusVisual(char.status);
  const alignmentLabel = char.alignment || "Unaligned";
  const openProfile = () => onOpen(char);
  const handleProfileKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProfile();
    }
  };
  return (
    <motion.div
      ref={cardRef}
      layout
      animate={pulse ? { rotate: [0, -1.5, 1.5, -0.75, 0.75, 0], scale: [1, 1.02, 0.99, 1.01, 1] } : { rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 230, damping: 20 }}
    >
      <Card
        className={cx(
          "flex h-full flex-col overflow-hidden bg-black/45 backdrop-blur-3xl",
          highlight ? "ring-2 ring-amber-300" : "ring-1 ring-inset ring-white/15"
        )}
      >
        <div className="relative">
          <div
            role="button"
            tabIndex={0}
            onClick={openProfile}
            onKeyDown={handleProfileKey}
            className="group relative block"
          >
            <div
              className={cx(
                "relative aspect-[4/5] overflow-hidden rounded-[28px] border border-white/15",
                statusMeta?.ring
              )}
            >
              <ImageSafe
                src={heroImage}
                alt={char.name}
                fallbackLabel={char.name}
                className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4">
                <div className="text-xs font-semibold text-white/80">{accentLabel}</div>
                <h3 className="text-lg font-black leading-tight text-white">{char.name}</h3>
                {primaryAlias && (
                  <span className="text-[11px] font-semibold text-white/65">{primaryAlias}</span>
                )}
              </div>
              {statusMeta && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                  <statusMeta.icon className="h-3.5 w-3.5 text-white/80" aria-hidden="true" />
                  <span>{statusMeta.label}</span>
                  <span className={cx("h-2 w-2 rounded-full", statusMeta.dot)} />
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              triggerSim();
            }}
            aria-label="Send to arena"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white shadow-lg transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <Swords size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-between px-4 pb-4 pt-3 text-white/80">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
              <span>{alignmentLabel}</span>
              {statusMeta && (
                <span className="flex items-center gap-1 text-white/70">
                  <span className={cx("h-2 w-2 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </span>
              )}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/75">{shortCaption}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {minimalFilters.map((item) => (
              <button
                key={`${char.id}-${item.key}-${item.value}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFacet?.(item);
                }}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-white/20"
              >
                {item.value}
              </button>
            ))}
            {!minimalFilters.length && !!highlightFacts.length && (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                {highlightFacts.join(" • ")}
              </span>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                openProfile();
              }}
              className="px-4 text-xs font-semibold text-white/70 transition hover:text-white"
            >
              View Profile
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
function Gallery({ images, cover, name }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const sources = useMemo(() => [cover, ...(images || [])].filter(Boolean), [cover, images]);

  useEffect(() => {
    if (!sources.length) {
      setIndex(0);
      return;
    }
    setIndex((current) => (current >= sources.length ? 0 : current));
  }, [sources]);

  const goPrevious = useCallback(() => {
    if (!sources.length) return;
    setIndex((i) => (i - 1 + sources.length) % sources.length);
  }, [sources]);

  const goNext = useCallback(() => {
    if (!sources.length) return;
    setIndex((i) => (i + 1) % sources.length);
  }, [sources]);

  const openLightbox = useCallback(() => {
    if (sources.length) setLightboxOpen(true);
  }, [sources.length]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (!sources.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[32px] border border-white/15 bg-white/12">
        <Insignia label={name} size={72} />
      </div>
    );
  }

  const activeSrc = sources[index];

  return (
    <>
      <div
        className="group relative overflow-hidden rounded-[32px] border border-white/12 bg-black/40 shadow-[0_24px_80px_rgba(8,10,20,0.45)]"
        data-gallery-root
      >
        <div className="aspect-[3/4] w-full">
          <ImageSafe
            src={activeSrc}
            alt={`${name} gallery ${index + 1}`}
            fallbackLabel={name}
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={openLightbox}
          className="absolute inset-0 z-20 flex items-end justify-end bg-gradient-to-t from-black/45 via-black/10 to-transparent p-5 opacity-0 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 group-hover:opacity-100"
          aria-label="Open full-size gallery"
        >
          <span className="rounded-full border border-white/30 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/80 shadow-lg">
            Tap to expand
          </span>
        </button>
        {sources.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 group-hover:opacity-100"
              onClick={goPrevious}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 group-hover:opacity-100"
              onClick={goNext}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2">
              {sources.map((_, idx) => (
                <span key={idx} className={cx("h-1.5 w-5 rounded-full", idx === index ? "bg-white" : "bg-white/50")} />
              ))}
            </div>
          </>
        )}
      </div>
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            key="gallery-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6"
            data-gallery-root
            onClick={closeLightbox}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-black/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X size={16} /> Close
            </button>
            <div
              className="flex max-h-[80vh] w-full max-w-4xl items-center justify-center gap-4"
              onClick={(event) => event.stopPropagation()}
            >
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={goPrevious}
                  className="hidden rounded-full border border-white/20 bg-black/60 p-3 text-white shadow-lg transition hover:bg-black/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 sm:inline-flex"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="relative flex-1">
                <ImageSafe
                  src={activeSrc}
                  alt={`${name} full image ${index + 1}`}
                  fallbackLabel={name}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-[32px] border border-white/20 object-contain shadow-[0_40px_140px_rgba(0,0,0,0.6)]"
                />
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2 text-[11px] font-semibold text-white/80">
                  <span>
                    {index + 1} / {sources.length}
                  </span>
                  <span className="hidden sm:inline">{name}</span>
                </div>
              </div>
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="hidden rounded-full border border-white/20 bg-black/60 p-3 text-white shadow-lg transition hover:bg-black/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 sm:inline-flex"
                  aria-label="Next image"
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
            {sources.length > 1 && (
              <div className="mt-6 flex gap-2">
                {sources.map((src, idx) => (
                  <button
                    key={src + idx}
                    type="button"
                    onClick={() => setIndex(idx)}
                    className={cx(
                      "h-2.5 w-8 rounded-full transition",
                      idx === index ? "bg-white" : "bg-white/30 hover:bg-white/60"
                    )}
                    aria-label={`View image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CharacterModal({ open, onClose, char, onFacet, onUseInSim, onNavigate }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const pointerStart = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = typeof document !== "undefined" ? document.activeElement : null;
    const node = dialogRef.current;
    if (!node) return undefined;
    const focusable = node.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && typeof onNavigate === "function") {
        if (!node.contains(event.target)) return;
        if (event.target?.closest?.("[data-gallery-root]")) return;
        event.preventDefault();
        onNavigate(event.key === "ArrowRight" ? 1 : -1);
      }
      if (event.key === "Tab" && focusable.length) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current && previouslyFocused.current.focus?.();
    };
  }, [open, onClose, onNavigate]);

  const handlePointerDown = useCallback(
    (event) => {
      if (typeof onNavigate !== "function") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerStart.current = {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
      };
    },
    [onNavigate]
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (!pointerStart.current || typeof onNavigate !== "function") return;
      const start = pointerStart.current;
      pointerStart.current = null;
      if (start.target?.closest?.("[data-gallery-root]")) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        onNavigate(dx < 0 ? 1 : -1);
      }
    },
    [onNavigate]
  );

  const resetPointer = useCallback(() => {
    pointerStart.current = null;
  }, []);
  if (!open || !char) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <Aurora className="opacity-70" />
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-black/65 backdrop-blur-2xl"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
      >
        <div className="grid items-center gap-4 border-b border-white/15 px-6 py-4 text-white md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-center gap-4">
            <Insignia label={char.name} size={48} />
            <div>
              <div id={titleId} className="text-3xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {char.name}
              </div>
              {char.era && <div className="text-[11px] font-extrabold tracking-[0.3em] text-white/70">{char.era}</div>}
            </div>
          </div>
          <div className="flex justify-center">
            <Button
              variant="gradient"
              size="sm"
              onClick={() => onUseInSim(char)}
              aria-label="Send to arena"
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold shadow-[0_18px_48px_rgba(253,230,138,0.35)] sm:text-sm"
            >
              <Swords size={16} />
              <span>Battle Arena</span>
            </Button>
          </div>
          <div className="flex justify-end gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close profile">
              <X />
            </Button>
          </div>
        </div>
        <div className="grid max-h-[75vh] grid-cols-1 gap-6 overflow-y-auto p-6 text-white lg:grid-cols-2">
          <div className="space-y-5">
            <Gallery images={char.gallery} cover={char.cover} name={char.name} />
            <div className="space-y-3 text-sm font-semibold text-white/80">
              <div>
                <div className="text-xs font-extrabold tracking-wide text-white">Short Description</div>
                <div className="mt-1 text-white/80">{char.shortDesc || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-wide text-white">Bio</div>
                <div className="mt-1 whitespace-pre-wrap text-white/80">{char.longDesc || "—"}</div>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(char.alias || []).map((alias) => (
                <FacetChip key={alias} onClick={() => onFacet({ key: "alias", value: alias })}>
                  {alias}
                </FacetChip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {char.gender && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">Gender</div>
                  <div className="text-base font-extrabold">{char.gender}</div>
                </div>
              )}
              {char.alignment && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">Alignment</div>
                  <div className="text-base font-extrabold">{char.alignment}</div>
                </div>
              )}
              {char.status && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">Status</div>
                  <div className="text-base font-extrabold">{char.status}</div>
                </div>
              )}
              {char.firstAppearance && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">First Appearance</div>
                  <div className="text-base font-extrabold">{char.firstAppearance}</div>
                </div>
              )}
            </div>
            {!!(char.locations || []).length && (
              <div>
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/70">
                  <MapPin size={14} /> Locations
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(char.locations || []).map((loc) => (
                    <FacetChip key={loc} onClick={() => onFacet({ key: "locations", value: loc })}>
                      {loc}
                    </FacetChip>
                  ))}
                </div>
              </div>
            )}
            {!!(char.faction || []).length && (
              <div>
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/70">
                  <Crown size={14} /> Factions / Teams
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(char.faction || []).map((faction) => (
                    <FacetChip key={faction} onClick={() => onFacet({ key: "faction", value: faction })}>
                      {faction}
                    </FacetChip>
                  ))}
                </div>
              </div>
            )}
            {!!(char.tags || []).length && (
              <div>
                <div className="text-sm mb-2 font-bold flex items-center gap-2">
                  <Layers size={14} /> Tags
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(char.tags || []).map((tag) => (
                    <FacetChip key={tag} onClick={() => onFacet({ key: "tags", value: tag })}>
                      {tag}
                    </FacetChip>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/70">
                <Atom size={14} /> Powers
              </div>
              <div className="mt-3 space-y-2">
                {(char.powers || []).map((power) => (
                  <div key={power.name}>
                    <div className="mb-1 flex items-center justify-between text-sm font-bold">
                      <span className="truncate pr-3">{power.name}</span>
                      <span>{power.level}/10</span>
                    </div>
                    <PowerMeter level={power.level} accent="emerald" />
                  </div>
                ))}
              </div>
            </div>
            {!!(char.stories || []).length && (
              <div>
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/70">
                  <Library size={14} /> Stories
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(char.stories || []).map((story) => (
                    <FacetChip key={story} onClick={() => onFacet({ key: "stories", value: story })}>
                      {story}
                    </FacetChip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 24;
function CharacterGrid({ data, onOpen, onFacet, onUseInSim, highlightId }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [data]);
  useEffect(() => {
    const handler = () => {
      const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 320) {
        setPage((current) => (current * PAGE_SIZE < data.length ? current + 1 : current));
      }
    };
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, [data.length]);
  const slice = data.slice(0, page * PAGE_SIZE);
  return (
    <div className="grid grid-cols-2 gap-4 pb-24 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {slice.map((c) => (
        <CharacterCard
          key={c.id}
          char={c}
          onOpen={onOpen}
          onFacet={onFacet}
          onUseInSim={onUseInSim}
          highlight={highlightId === c.id}
        />
      ))}
      {!slice.length && <div className="text-lg font-black text-white">No characters match your filters… yet.</div>}
    </div>
  );
}

/** -------------------- Battle Arena++ -------------------- */
function scoreCharacter(c) {
  const base = (c.powers || []).reduce((s, p) => s + (isFinite(p.level) ? p.level : 0), 0);
  const elite = (c.tags || []).some((t) => /leader|legend|mythic|prime/i.test(t)) ? 3 : 0;
  const eraMod = /old gods|ancient/i.test(c.era || "") ? 1.07 : 1;
  const origin = powerOriginProfile(c);
  const withBias = (base + elite) * origin.multiplier * eraMod;
  return Math.round(withBias);
}
function rngLuck(max) {
  const r = (Math.random() * 2 - 1) * 0.2 * max; // ±20%
  return Math.round(r);
}
function powerOriginProfile(c) {
  const text = [
    (c.tags || []).join(" "),
    (c.alias || []).join(" "),
    c.longDesc || "",
    c.shortDesc || "",
  ].join(" ").toLowerCase();
  // crude but effective class detection
  const isGod = /(god|goddess|deity|divine|celestial|primordial)/i.test(text) || /old gods|ancient gods/i.test(c.era || "");
  const isAlien = /(alien|extraterrestrial|offworld|cosmic)/i.test(text);
  const isMythic = /(demon|spirit|ethereal|eldritch|angel)/i.test(text);
  const isMeta = /(meta|mutant|enhanced|super soldier|augment)/i.test(text) || (c.powers || []).some((p) => p.level >= 7);
  if (isGod) return { label: "Divine", multiplier: 1.6 };
  if (isAlien) return { label: "Alien", multiplier: 1.28 };
  if (isMythic) return { label: "Mythic", multiplier: 1.24 };
  if (isMeta) return { label: "Enhanced", multiplier: 1.14 };
  if (/human|civilian/.test(text)) return { label: "Human", multiplier: 1.0 };
  return { label: "Legend", multiplier: 1.08 };
}

function duel(c1, c2) {
  const s1 = scoreCharacter(c1);
  const s2 = scoreCharacter(c2);
  const origin1 = powerOriginProfile(c1);
  const origin2 = powerOriginProfile(c2);
  const maxBase = Math.max(s1, s2) || 1;
  const swings = 3;
  let h1 = 100;
  let h2 = 100;
  const logs = [];
  for (let i = 0; i < swings; i += 1) {
    const luck1 = rngLuck(maxBase);
    const luck2 = rngLuck(maxBase);
    const offensive1 = s1 + luck1;
    const offensive2 = s2 + luck2;
    const shield1 = s1 * 0.35;
    const shield2 = s2 * 0.35;
    const delta1 = Math.max(0, offensive1 - shield2);
    const delta2 = Math.max(0, offensive2 - shield1);
    const combined = Math.max(1, delta1 + delta2);
    const dmg1 = Math.round((delta1 / combined) * 48);
    const dmg2 = Math.round((delta2 / combined) * 48);
    h2 = Math.max(0, h2 - dmg1);
    h1 = Math.max(0, h1 - dmg2);
    logs.push({
      swing: i + 1,
      luck1,
      luck2,
      offensive1,
      offensive2,
      dmg1,
      dmg2,
      h1,
      h2,
    });
  }
  let winner;
  if (h1 === h2) {
    winner = s1 === s2 ? (Math.random() > 0.5 ? c1 : c2) : s1 > s2 ? c1 : c2;
  } else {
    winner = h1 > h2 ? c1 : c2;
  }
  const loser = winner === c1 ? c2 : c1;
  return {
    winner,
    loser,
    h1,
    h2,
    logs,
    breakdown: {
      s1,
      s2,
      origin1,
      origin2,
    },
  };
}

function computeBattleTimeline(charA, charB) {
  const summary = duel(charA, charB);
  const timeline = summary.logs.map((phase) => ({
    round: phase.swing,
    strikeA: Math.round(phase.offensive1),
    strikeB: Math.round(phase.offensive2),
    luckA: phase.luck1,
    luckB: phase.luck2,
    damageToB: phase.dmg1,
    damageToA: phase.dmg2,
    healthA: phase.h1,
    healthB: phase.h2,
  }));

  return {
    timeline,
    winner: summary.winner,
    loser: summary.loser,
    finalScoreA: summary.breakdown.s1,
    finalScoreB: summary.breakdown.s2,
    finalHealthA: summary.h1,
    finalHealthB: summary.h2,
    breakdown: summary.breakdown,
  };
}

function ArenaCard({ char, position, onRelease, onOpen, health, isWinner, showX, onAutoFill, onRandomize }) {
  if (!char) {
    return (
      <button
        type="button"
        onClick={() => onAutoFill?.()}
        className="group flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-500/60 bg-slate-900/40 p-6 text-center text-sm font-bold text-slate-300 transition hover:border-amber-300/60 hover:bg-slate-900/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        aria-label={`Summon a random combatant for slot ${position}`}
      >
        <span className="text-base font-black tracking-[0.3em] text-slate-400 group-hover:text-amber-200">
          Combatant {position}
        </span>
        <span className="max-w-[16rem] text-xs font-semibold text-slate-400 group-hover:text-slate-100">
          Tap to deploy a random warrior from the codex
        </span>
      </button>
    );
  }
  const [expanded, setExpanded] = useState(false);
  const healthGradient = health > 60 ? "from-emerald-300 to-emerald-500" : health > 30 ? "from-amber-300 to-amber-500" : "from-rose-400 to-red-500";
  const powers = char.powers || [];
  const visiblePowers = expanded ? powers : powers.slice(0, 4);
  const hasMorePowers = powers.length > 4;
  const topLocations = (char.locations || []).slice(0, 2);
  const topFactions = (char.faction || []).slice(0, 2);
  const topTags = (char.tags || []).slice(0, 3);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, index) => ({
        id: `${char.id}-confetti-${index}`,
        delay: index * 0.05,
        left: Math.random() * 100,
        duration: 1.2 + Math.random() * 0.6,
        color: `hsl(${Math.floor(Math.random() * 360)}, 82%, ${60 + Math.random() * 20}%)`,
      })),
    [char.id]
  );
  return (
    <motion.div
      layout
      className={cx(
        "relative h-full rounded-3xl border border-slate-700 bg-slate-950/90 p-3 text-left text-slate-100 shadow-[0_25px_80px_rgba(6,7,12,0.65)] sm:p-5",
        isWinner ? "ring-4 ring-emerald-400 scale-[1.02]" : "",
        showX ? "ring-2 ring-red-500" : ""
      )}
      animate={isWinner ? { scale: [1, 1.03, 1], boxShadow: "0 30px 80px rgba(16,185,129,0.35)" } : {}}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
    >
      <AnimatePresence>
        {isWinner && (
          <motion.div
            key="confetti"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {confettiPieces.map((piece) => (
              <motion.span
                key={piece.id}
                className="absolute h-1 w-6 rounded-full"
                style={{
                  background: piece.color,
                  left: `${piece.left}%`,
                }}
                initial={{ top: "-10%", opacity: 0, rotate: 0 }}
                animate={{ top: "110%", opacity: [0, 1, 0], rotate: [0, 360, 720] }}
                transition={{ duration: piece.duration, delay: piece.delay, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {showX && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-6xl font-black text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: 1 }}
        >
          X
        </motion.div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] sm:text-xs">
        <Badge className="bg-slate-800/80 px-3 py-1 text-[9px] tracking-[0.3em] text-slate-200">Combatant {position}</Badge>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-[9px] sm:h-auto sm:text-[11px]"
            onClick={() => onRandomize?.()}
            aria-label="Randomise combatant"
          >
            <RefreshCcw className="mr-0 h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Randomise</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-[9px] sm:h-auto sm:text-[11px]"
            onClick={() => onOpen(char)}
            aria-label="View combatant details"
          >
            <span className="hidden sm:inline">Details</span>
            <ArrowRight className="h-3.5 w-3.5 sm:hidden" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-[9px] sm:h-auto sm:text-[11px]"
            onClick={() => onRelease(char.id)}
            aria-label="Remove combatant"
          >
            <X className="mr-0 h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Release</span>
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center gap-2 text-center sm:hidden">
        <Insignia label={char.name} size={56} />
        <div className="text-base font-black text-white">{char.name}</div>
      </div>
      <button onClick={() => onOpen(char)} className="mt-3 block w-full text-left">
        <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-xs">Health</div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div
            key={health}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, health)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cx("h-full bg-gradient-to-r", healthGradient)}
          />
        </div>
      </button>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <ImageSafe
          src={char.cover || char.gallery?.[0]}
          alt={char.name}
          fallbackLabel={char.name}
          className="hidden h-24 w-24 rounded-2xl border border-slate-700 object-cover sm:block sm:h-32 sm:w-32"
        />
        <div className="flex-1 space-y-3 text-[10px] sm:text-xs">
          <div className="hidden text-lg font-black text-white sm:block sm:text-xl">{char.name}</div>
          <div className="grid grid-cols-2 gap-2">
            {char.gender && (
              <div>
                <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Gender</div>
                <div className="text-xs font-extrabold text-white sm:text-sm">{char.gender}</div>
              </div>
            )}
            {char.alignment && (
              <div className="hidden sm:block">
                <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Alignment</div>
                <div className="text-xs font-extrabold text-white sm:text-sm">{char.alignment}</div>
              </div>
            )}
            {char.status && (
              <div className="hidden sm:block">
                <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Status</div>
                <div className="text-xs font-extrabold text-white sm:text-sm">{char.status}</div>
              </div>
            )}
            {char.era && (
              <div>
                <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Era</div>
                <div className="text-xs font-extrabold text-white sm:text-sm">{char.era}</div>
              </div>
            )}
          </div>
          {!!topLocations.length && (
            <div className="hidden sm:block">
              <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Locations</div>
              <div className="flex flex-wrap gap-1">
                {topLocations.map((loc) => (
                  <span key={loc} className="rounded-full bg-slate-800/80 px-2 py-1 text-[9px] font-bold tracking-wide text-white sm:text-[10px]">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!topFactions.length && (
            <div>
              <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Factions</div>
              <div className="flex flex-wrap gap-1">
                {topFactions.map((faction) => (
                  <span key={faction} className="rounded-full bg-slate-800/80 px-2 py-1 text-[9px] font-bold tracking-wide text-white sm:text-[10px]">
                    {faction}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!topTags.length && (
            <div className="hidden sm:block">
              <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Tags</div>
              <div className="flex flex-wrap gap-1">
                {topTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-800/80 px-2 py-1 text-[9px] font-bold tracking-wide text-white sm:text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {visiblePowers.map((power) => (
          <div key={power.name}>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-slate-200 sm:text-xs">
              <span className="truncate pr-2">{power.name}</span>
              <span>{power.level}/10</span>
            </div>
            <PowerMeter level={power.level} accent="crimson" />
          </div>
        ))}
        {hasMorePowers && (
          <button
            type="button"
            onClick={() => setExpanded((state) => !state)}
            className="w-full rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold tracking-wide text-slate-200 transition hover:bg-slate-800"
          >
            {expanded ? "Hide extended powers" : `Reveal all ${powers.length} powers`}
          </button>
        )}
      </div>
      {!!(char.stories || []).length && (
        <div className="mt-4">
          <div className="text-[9px] font-bold tracking-wide text-slate-400 sm:text-[10px]">Stories</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-300 sm:text-[11px]">
            {(char.stories || []).map((story) => (
              <span key={story} className="rounded-full bg-slate-800/60 px-2 py-1">
                {story}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

const swordVariants = {
  idle: { rotate: 0, scale: 1, filter: "drop-shadow(0 0 0 rgba(255,255,255,0))" },
  charging: { rotate: [0, -5, 5, -8, 8, 0], scale: 1.05, filter: "drop-shadow(0 0 25px rgba(249,250,139,0.9))" },
  swing: { rotate: [0, -25, 25, -18, 18, 0], scale: 1.1, filter: "drop-shadow(0 0 35px rgba(255,255,255,0.9))" },
  explode: { rotate: [0, -15, 15, 0], scale: [1, 1.2, 0.9, 1], filter: "drop-shadow(0 0 45px rgba(255,196,12,1))" },
};

function BattleArena({ characters, slots, setSlots, onOpenCharacter, pulseKey, onClose }) {
  const left = characters.find((item) => item.id === slots.left) || null;
  const right = characters.find((item) => item.id === slots.right) || null;
  const [battleState, setBattleState] = useState("idle");
  const [timeline, setTimeline] = useState([]);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState({ left: 100, right: 100 });
  const [showX, setShowX] = useState(null);
  const [arenaPulse, setArenaPulse] = useState(false);

  useEffect(() => {
    if (!pulseKey) return;
    setArenaPulse(true);
    const timer = setTimeout(() => setArenaPulse(false), 700);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  useEffect(() => {
    setBattleState("idle");
    setTimeline([]);
    setResult(null);
    setHealth({ left: 100, right: 100 });
    setShowX(null);
  }, [left?.id, right?.id]);

  const release = (id) => {
    setSlots((prev) => ({
      left: prev.left === id ? null : prev.left,
      right: prev.right === id ? null : prev.right,
    }));
    setShowX(null);
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runBattle = async () => {
    if (!left || !right || left.id === right.id) return;
    const computed = computeBattleTimeline(left, right);
    setBattleState("charging");
    setResult(null);
    setTimeline([]);
    setHealth({ left: 100, right: 100 });
    setShowX(null);
    for (const phase of computed.timeline) {
      setBattleState("swing");
      setTimeline((prev) => [...prev, phase]);
      setHealth({ left: phase.healthA, right: phase.healthB });
      // eslint-disable-next-line no-await-in-loop
      await delay(650);
    }
    setBattleState("explode");
    await delay(450);
    setBattleState("idle");
    setResult(computed);
    setShowX(computed.loser.id);
    setTimeout(() => setShowX(null), 2200);
  };

  const fillSlot = useCallback(
    (side) => {
      if (!characters.length) return;
      setSlots((prev) => {
        if (prev[side]) return prev;
        const otherSide = side === "left" ? prev.right : prev.left;
        const pool = characters.filter((char) => char?.id && char.id !== otherSide);
        if (!pool.length) return prev;
        const random = pool[Math.floor(Math.random() * pool.length)];
        if (!random?.id) return prev;
        return { ...prev, [side]: random.id };
      });
    },
    [characters, setSlots]
  );

  const autoFillLeft = useCallback(() => fillSlot("left"), [fillSlot]);
  const autoFillRight = useCallback(() => fillSlot("right"), [fillSlot]);

  const reshuffleSlot = useCallback(
    (side) => {
      if (!characters.length) return;
      setSlots((prev) => {
        const otherSide = side === "left" ? prev.right : prev.left;
        const current = prev[side];
        const pool = characters.filter((char) => char?.id && char.id !== otherSide && char.id !== current);
        if (!pool.length) return prev;
        const random = pool[Math.floor(Math.random() * pool.length)];
        if (!random?.id) return prev;
        return { ...prev, [side]: random.id };
      });
    },
    [characters, setSlots]
  );

  const reset = () => {
    setSlots({ left: null, right: null });
    setTimeline([]);
    setResult(null);
    setHealth({ left: 100, right: 100 });
    setBattleState("idle");
    setShowX(null);
  };

  return (
    <motion.div
      layout
      animate={arenaPulse ? { scale: [1, 1.02, 0.99, 1.01, 1], boxShadow: "0 30px 100px rgba(15,23,42,0.55)" } : {}}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      <Card className="border border-white/10 bg-[#090b1a]/95 text-slate-100 shadow-[0_40px_120px_rgba(5,8,20,0.65)]">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold text-white">
              <Swords /> Battle Arena
            </CardTitle>
            <Badge className="bg-slate-800/70 text-slate-300">Luck recalculates every round</Badge>
            <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-slate-300">
              <span>Humans must earn their victories — gods begin ahead.</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:auto-rows-min lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="col-span-1 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-1">
              <ArenaCard
                char={left}
                position="A"
                onRelease={release}
                onOpen={onOpenCharacter}
                health={health.left}
                isWinner={result?.winner?.id === left?.id}
                showX={showX === left?.id}
                onAutoFill={autoFillLeft}
                onRandomize={() => reshuffleSlot("left")}
              />
            </div>
            <div className="col-span-1 order-2 min-w-0 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1">
              <ArenaCard
                char={right}
                position="B"
                onRelease={release}
                onOpen={onOpenCharacter}
                health={health.right}
                isWinner={result?.winner?.id === right?.id}
                showX={showX === right?.id}
                onAutoFill={autoFillRight}
                onRandomize={() => reshuffleSlot("right")}
              />
            </div>
            <div className="order-3 col-span-2 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-800/60 bg-[#0f1329]/80 p-4 text-center lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-end-2 lg:self-stretch lg:justify-self-center lg:p-5">
              <motion.button
                type="button"
                onClick={runBattle}
                animate={battleState}
                variants={swordVariants}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-rose-300 p-4 text-slate-900 shadow-[0_0_60px_rgba(251,191,36,0.45)] focus:outline-none"
                aria-label="Initiate duel"
              >
                <Swords className="h-10 w-10" />
              </motion.button>
              <div className="flex flex-col gap-2 text-[10px] font-bold text-slate-200 sm:text-xs">
                <Button variant="gradient" size="sm" onClick={runBattle} className="text-[10px] sm:text-[11px]">
                  Fight
                </Button>
                <Button variant="destructive" size="sm" onClick={reset} className="text-[10px] sm:text-[11px]">
                  Reset Arena
                </Button>
                {onClose && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="text-[10px] sm:text-[11px]"
                  >
                    Close Arena
                  </Button>
                )}
                <span className="text-[10px] font-semibold tracking-[0.3em] text-slate-400">
                  Tap combatants to view dossiers
                </span>
              </div>
            </div>
          </div>
          {result && (
            <div className="rounded-2xl border border-white/10 bg-[#0d1126] px-4 py-5 text-center">
              <div className="text-xs font-bold tracking-wide text-slate-500">Winner</div>
              <div className="mt-2 rounded-xl bg-slate-900 px-4 py-3 text-lg font-black text-slate-100">
                {result.winner.name}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Final totals — {left?.name}: {result.finalScoreA} • {right?.name}: {result.finalScoreB}
              </div>
            </div>
          )}
          {timeline.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0f1329]/80 p-4 text-xs backdrop-blur">
              <div className="mb-2 text-sm font-black tracking-wide text-slate-200">Battle Flow</div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {timeline.map((phase) => (
                  <div key={phase.round} className="rounded-xl border border-white/10 bg-[#141a38]/80 p-3 text-slate-200">
                    <div className="text-[11px] font-bold tracking-wide text-slate-400">Round {phase.round}</div>
                    <div className="mt-2 space-y-1">
                      <div>A Strike: {phase.strikeA}</div>
                      <div>A Luck: {phase.luckA}</div>
                      <div>A Health: {phase.healthA}%</div>
                      <div className="pt-1">B Strike: {phase.strikeB}</div>
                      <div>B Luck: {phase.luckB}</div>
                      <div>B Health: {phase.healthB}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SidebarFilters({ data, filters, setFilters, combineAND, setCombineAND, onClear }) {
  const uniq = (arr) => Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const genders = useMemo(() => uniq(data.map((item) => item.gender || "")), [data]);
  const alignments = useMemo(() => uniq(data.map((item) => item.alignment || "")), [data]);
  const locations = useMemo(() => uniq(data.flatMap((item) => item.locations || [])), [data]);
  const factions = useMemo(() => uniq(data.flatMap((item) => item.faction || [])), [data]);
  const eras = useMemo(() => uniq(data.map((item) => item.era || "")), [data]);
  const tags = useMemo(() => uniq(data.flatMap((item) => item.tags || [])), [data]);
  const statuses = useMemo(() => uniq(data.map((item) => item.status || "")), [data]);
  const stories = useMemo(() => uniq(data.flatMap((item) => item.stories || [])), [data]);
  const powers = useMemo(() => uniq(data.flatMap((item) => (item.powers || []).map((p) => p.name))), [data]);

  const toggle = (key, value, single = false) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (single) {
        next[key] = next[key] === value ? undefined : value;
        return next;
      }
      const set = new Set([...(next[key] || [])]);
      set.has(value) ? set.delete(value) : set.add(value);
      next[key] = Array.from(set);
      return next;
    });
  };
  const blendTooltipId = useId();

  return (
    <div className="space-y-6 p-5 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
          <Filter className="text-amber-300" /> Filters
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold tracking-wide">Mode</span>
          <Badge className="bg-white/10 text-white/80">{combineAND ? "AND" : "Blend"}</Badge>
          <Switch checked={combineAND} onCheckedChange={setCombineAND} aria-describedby={blendTooltipId} />
        </div>
      </div>
      <p className="text-[11px] font-semibold leading-relaxed text-white/65">
        Use the global search above the codex for anything specific. These filters stay open so you can tap through factions,
        locations, powers, and more without losing your place.
      </p>
      <p id={blendTooltipId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold leading-relaxed text-white/70">
        Blend finds legends that match any of your selections. Switch to AND for precise dossiers that match every chosen filter.
      </p>
      <Button variant="destructive" className="w-full" onClick={onClear}>
        Clear all
      </Button>
      <FilterSection
        title="Gender / Sex"
        values={genders}
        single
        activeValues={filters.gender}
        onToggle={(value) => toggle("gender", value, true)}
      />
      <FilterSection
        title="Alignment"
        values={alignments}
        single
        activeValues={filters.alignment}
        onToggle={(value) => toggle("alignment", value, true)}
      />
      <FilterSection
        title="Era"
        values={eras}
        activeValues={filters.era || []}
        onToggle={(value) => toggle("era", value)}
      />
      <FilterSection
        title="Locations"
        values={locations}
        activeValues={filters.locations || []}
        onToggle={(value) => toggle("locations", value)}
      />
      <FilterSection
        title="Faction / Team"
        values={factions}
        activeValues={filters.faction || []}
        onToggle={(value) => toggle("faction", value)}
      />
      <FilterSection
        title="Powers"
        values={powers}
        activeValues={filters.powers || []}
        onToggle={(value) => toggle("powers", value)}
      />
      <FilterSection
        title="Tags"
        values={tags}
        activeValues={filters.tags || []}
        onToggle={(value) => toggle("tags", value)}
      />
      <FilterSection
        title="Status"
        values={statuses}
        activeValues={filters.status || []}
        onToggle={(value) => toggle("status", value)}
      />
      <FilterSection
        title="Stories"
        values={stories}
        activeValues={filters.stories || []}
        onToggle={(value) => toggle("stories", value)}
      />
    </div>
  );
}

function ScrollShortcuts() {
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

function FilterDrawer({ open, onClose, children }) {
  const drawerRef = useRef(null);
  const previouslyFocused = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = typeof document !== "undefined" ? document.activeElement : null;
    const node = drawerRef.current;
    if (!node) return undefined;
    const focusable = node.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && focusable.length) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current && previouslyFocused.current.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-full overflow-y-auto border-l border-white/10 bg-[#070a19] shadow-[0_40px_120px_rgba(7,10,25,0.6)] sm:max-w-md"
            style={{ width: "min(28rem, calc(100vw * 0.66))" }}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-xs font-bold tracking-[0.35em] text-white/70">Filters</div>
              <Button variant="ghost" onClick={onClose} className="text-xs font-bold tracking-wide text-white/80">
                <X size={14} /> Close
              </Button>
            </div>
            <div className="pb-12">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}


function ToolsBar({
  query,
  onQueryChange,
  sortMode,
  onSortModeChange,
  onOpenFilters,
  onClearFilters,
  onArenaToggle,
  onSync,
  showArena,
  totalCount,
  filteredCount,
  hasActiveFilters,
}) {
  const [barHeight, setBarHeight] = useState(0);
  const [lastKnownHeight, setLastKnownHeight] = useState(0);
  const [mode, setMode] = useState("attached");
  const [contentEl, setContentEl] = useState(null);
  const [heroEl, setHeroEl] = useState(null);
  const [mountEl, setMountEl] = useState(null);
  const [displayMode, setDisplayMode] = useState("full");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const handleContentRef = useCallback((node) => {
    setContentEl(node);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    setHeroEl(document.getElementById("hero-showcase"));
    setMountEl(document.getElementById("hero-toolbar-mount"));
    return undefined;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!contentEl || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setBarHeight(entry.contentRect.height);
      }
    });
    observer.observe(contentEl);
    setBarHeight(contentEl.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [contentEl]);

  useEffect(() => {
    if (barHeight > 0) {
      setLastKnownHeight(barHeight);
    }
  }, [barHeight]);

  useEffect(() => {
    if (!isMobile && displayMode === "compact") {
      setDisplayMode("full");
    }
  }, [isMobile, displayMode]);

  useEffect(() => {
    if (!isMobile) return;
    if (showArena) {
      setDisplayMode("hidden");
    }
  }, [isMobile, showArena]);

  useIsomorphicLayoutEffect(() => {
    if (!heroEl) return undefined;
    const height = barHeight || lastKnownHeight || 0;
    heroEl.style.setProperty("--toolbar-offset", `${Math.ceil(height + 160)}px`);
    return () => {
      heroEl.style.removeProperty("--toolbar-offset");
    };
  }, [heroEl, barHeight, lastKnownHeight]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined" || !heroEl) return undefined;
    const update = () => {
      const rect = heroEl.getBoundingClientRect();
      const height = barHeight || lastKnownHeight || 0;
      if (!height) {
        setMode("attached");
        return;
      }
      const threshold = height + 8;
      if (rect.bottom <= threshold) {
        setMode("fixed");
      } else {
        setMode("attached");
      }
    };

    update();
    const opts = { passive: true };
    window.addEventListener("scroll", update, opts);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [heroEl, barHeight, lastKnownHeight]);

  const cycleDisplayMode = useCallback(() => {
    if (isMobile) {
      setDisplayMode((state) => {
        if (state === "full") return "compact";
        if (state === "compact") return "hidden";
        return "full";
      });
    } else {
      setDisplayMode((state) => (state === "full" ? "hidden" : "full"));
    }
  }, [isMobile]);

  const showFullControls = useCallback(() => {
    setDisplayMode("full");
  }, []);

  const effectiveHeight = barHeight || lastKnownHeight || 0;
  const placeholderHeight = mode === "fixed" && displayMode !== "hidden" ? effectiveHeight + 16 : 0;
  const countLabel = hasActiveFilters ? `${filteredCount} / ${totalCount} in view` : `${totalCount} catalogued`;
  const shortCountLabel = hasActiveFilters ? `${filteredCount}/${totalCount}` : `${totalCount}`;

  const renderToolbar = () => (
    <AnimatePresence initial={false} mode="wait">
      {displayMode === "hidden" ? null : displayMode === "compact" ? (
        <motion.div
          key="toolbar-compact"
          ref={handleContentRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className={cx(
            "border border-white/12 bg-[#070b1c]/90 shadow-[0_14px_40px_rgba(8,8,20,0.45)] backdrop-blur-xl",
            isMobile ? "rounded-none border-x-0 border-t border-white/10 border-b border-white/15 px-3 py-2" : "rounded-2xl px-4 py-2.5"
          )}
        >
          {isMobile ? (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={showFullControls}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Expand controls"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = SORT_OPTIONS.findIndex((item) => item.value === sortMode);
                  const next = SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length];
                  onSortModeChange(next.value);
                }}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Cycle sort order"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onOpenFilters}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Open filters"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Clear filters"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onArenaToggle}
                className={cx(
                  "inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border transition",
                  showArena ? "border-amber-200/70 bg-amber-200/20 text-white" : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                )}
                aria-label={showArena ? "Hide arena" : "Open arena"}
                aria-pressed={showArena}
              >
                <Swords className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onSync}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Sync universe"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="ml-1 flex flex-none items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">
                <Users className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                <span>{shortCountLabel}</span>
              </div>
              <button
                type="button"
                onClick={cycleDisplayMode}
                className="ml-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Hide universe controls"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="relative flex-1">
                <span className="sr-only" id="universe-search-compact">
                  Search heroes, powers, locations and tags
                </span>
                <Input
                  aria-labelledby="universe-search-compact"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search"
                  className="h-10 w-full rounded-lg border border-white/15 bg-white/10 pl-9 pr-3 text-xs text-white placeholder:text-white/50"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" aria-hidden="true" />
              </label>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = SORT_OPTIONS.findIndex((item) => item.value === sortMode);
                  const next = SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length];
                  onSortModeChange(next.value);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Cycle sort order"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFilters}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/15 bg-white/10 p-0 text-white hover:bg-white/20"
                aria-label="Open filters"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/15 bg-white/10 p-0 text-white hover:bg-white/20"
                aria-label="Clear filters"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
              <button
                type="button"
                onClick={onArenaToggle}
                className={cx(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg border text-white transition",
                  showArena ? "border-amber-200/70 bg-amber-200/20" : "border-white/15 bg-white/10 hover:bg-white/20"
                )}
                aria-label={showArena ? "Hide arena" : "Open arena"}
                aria-pressed={showArena}
              >
                <Swords className="h-4 w-4" aria-hidden="true" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/15 bg-white/10 p-0 text-white hover:bg-white/20"
                aria-label="Sync universe"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <button
                type="button"
                onClick={cycleDisplayMode}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Hide universe controls"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="toolbar-full"
          ref={handleContentRef}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={cx(
            "border border-white/12 bg-[#070b1c]/90 shadow-[0_20px_60px_rgba(8,8,20,0.45)] backdrop-blur-xl",
            isMobile ? "rounded-none border-x-0 border-t border-white/10 border-b border-white/15 px-3 py-3" : "rounded-3xl p-4"
          )}
        >
          {isMobile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <label className="relative flex-1">
                  <span className="sr-only" id="universe-search-label">
                    Search heroes, powers, locations and tags
                  </span>
                  <Input
                    aria-labelledby="universe-search-label"
                    id="universe-search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search the universe"
                    className="h-10 w-full rounded-xl border border-white/15 bg-white/15 pl-9 pr-3 text-xs font-semibold text-white placeholder:text-white/55"
                  />
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" aria-hidden="true" />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = SORT_OPTIONS.findIndex((item) => item.value === sortMode);
                    const next = SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length];
                    onSortModeChange(next.value);
                  }}
                  className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Cycle sort order"
                >
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                <div className="flex basis-[40%] flex-none items-center justify-center gap-1 rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-white/80">
                  <Users className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                  <span>{shortCountLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenFilters}
                  className="flex basis-[30%] flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white transition hover:bg-white/20"
                  aria-label="Open filters"
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Filters</span>
                </button>
                <button
                  type="button"
                  onClick={onArenaToggle}
                  className={cx(
                    "flex basis-[30%] flex-none items-center justify-center rounded-lg border px-2 py-2 transition",
                    showArena ? "border-amber-200/70 bg-amber-200/20 text-white" : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  )}
                  aria-pressed={showArena}
                  aria-label={showArena ? "Hide arena" : "Open arena"}
                >
                  <Swords className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Arena</span>
                </button>
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="flex basis-[30%] flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white transition hover:bg-white/20"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Clear</span>
                </button>
                <button
                  type="button"
                  onClick={onSync}
                  className="flex basis-[30%] flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white transition hover:bg-white/20"
                  aria-label="Sync universe"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Sync</span>
                </button>
                <button
                  type="button"
                  onClick={cycleDisplayMode}
                  className="flex basis-[30%] flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white transition hover:bg-white/20"
                  aria-label="Show icon controls"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Icon mode</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label className="relative flex-1 min-w-[220px]">
                <span className="sr-only" id="universe-search-label">
                  Search heroes, powers, locations and tags
                </span>
                <Input
                  aria-labelledby="universe-search-label"
                  id="universe-search"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search characters, powers, locations, tags…"
                  className="w-full rounded-2xl bg-white/15 pl-10 pr-3 text-sm text-white placeholder:text-white/60"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" aria-hidden="true" />
              </label>
              <div className="relative w-full min-w-[160px] sm:w-48">
                <span className="sr-only" id="sort-menu-label">
                  Sort heroes
                </span>
                <select
                  aria-labelledby="sort-menu-label"
                  value={sortMode}
                  onChange={(event) => onSortModeChange(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-white/25 bg-black/70 px-3 py-2 pr-9 text-sm font-semibold text-white shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {SORT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value} className="bg-black text-white">
                      {item.label}
                    </option>
                  ))}
                </select>
                <ArrowDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" aria-hidden="true" />
              </div>
              <Button
                variant="gradient"
                size="sm"
                onClick={onOpenFilters}
                className="flex-none shadow-[0_15px_40px_rgba(250,204,21,0.3)]"
                aria-label="Open filters"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold sm:text-sm">Filters</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="flex-none"
                aria-label="Clear filters"
              >
                <X size={14} aria-hidden="true" />
                <span className="text-xs font-semibold sm:text-sm">Clear</span>
              </Button>
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                <Users className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                <span>{countLabel}</span>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={onArenaToggle}
                className={cx("flex-none", showArena ? "ring-2 ring-amber-300/70" : "")}
                aria-pressed={showArena}
                aria-label={showArena ? "Hide arena" : "Open arena"}
              >
                <Swords size={14} aria-hidden="true" />
                <span className="text-xs font-semibold sm:text-sm">{showArena ? "Hide Arena" : "Arena"}</span>
              </Button>
              <Button
                variant="dark"
                size="sm"
                onClick={onSync}
                className="flex-none"
                aria-label="Sync universe"
              >
                <RefreshCcw size={14} aria-hidden="true" />
                <span className="text-xs font-semibold sm:text-sm">Sync</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleDisplayMode}
                className="flex-none px-4 sm:px-3"
                aria-label="Hide universe controls"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold">Hide</span>
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  let renderedToolbar;
  if (mode === "fixed") {
    renderedToolbar = (
      <div className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">{renderToolbar()}</div>
      </div>
    );
  } else if (mountEl) {
    renderedToolbar = createPortal(
      <div className="pointer-events-none px-4 pt-6 pb-10 sm:px-8 lg:px-16 xl:px-20 2xl:px-24">
        <div className="pointer-events-auto">{renderToolbar()}</div>
      </div>,
      mountEl
    );
  } else {
    renderedToolbar = <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-4">{renderToolbar()}</div>;
  }

  const hiddenActivator = displayMode === "hidden" ? (
    <Button
      type="button"
      onClick={showFullControls}
      variant="gradient"
      size="sm"
      className="fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
      aria-label="Show universe controls"
    >
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
      <span>Controls</span>
    </Button>
  ) : null;

  return (
    <>
      {renderedToolbar}
      {hiddenActivator}
      <div style={{ height: placeholderHeight }} aria-hidden="true" />
    </>
  );
}


function QuickFilterRail({ data, onFacet, onSortModeChange, sortMode, onOpenFilters }) {
  const [open, setOpen] = useState(false);
  const quickSorts = [
    { value: "default", label: "Featured" },
    { value: "az", label: "A-Z" },
    { value: "faction", label: "By Faction" },
    { value: "most", label: "Most Powerful" },
  ];

  const topCollections = useMemo(() => {
    const tally = (getter) => {
      const counts = new Map();
      data.forEach((item) => {
        getter(item).forEach((value) => {
          if (!value) return;
          const entry = counts.get(value) || { count: 0 };
          entry.count += 1;
          counts.set(value, entry);
        });
      });
      return Array.from(counts.entries())
        .map(([value, meta]) => ({ value, count: meta.count }))
        .sort((a, b) => b.count - a.count);
    };

    const locations = tally((item) => item.locations || []).slice(0, 6);
    const factions = tally((item) => item.faction || []).slice(0, 6);

    const powerMap = new Map();
    data.forEach((item) => {
      (item.powers || []).forEach((power) => {
        if (!power?.name) return;
        const entry = powerMap.get(power.name) || { count: 0, total: 0 };
        entry.count += 1;
        entry.total += Number(power.level) || 0;
        powerMap.set(power.name, entry);
      });
    });
    const powers = Array.from(powerMap.entries())
      .map(([name, meta]) => ({
        value: name,
        count: meta.count,
        avg: meta.count ? meta.total / meta.count : 0,
      }))
      .sort((a, b) => {
        if (b.avg === a.avg) return b.count - a.count;
        return b.avg - a.avg;
      })
      .slice(0, 8);

    return { locations, factions, powers };
  }, [data]);

  const renderChip = (item, key) => (
    <button
      key={`${key}-${item.value}`}
      type="button"
      onClick={() => onFacet({ key, value: item.value })}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-amber-200/70 hover:bg-amber-200/15"
    >
      <span>{item.value}</span>
      <span className="text-[11px] text-white/60">{item.count}</span>
    </button>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.45em] text-white/70 transition hover:border-white/40 hover:bg-white/10"
        aria-expanded="false"
      >
        <span className="flex items-center gap-2 text-white/80">
          <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" /> Discover quickly
        </span>
        <ChevronDown className="h-4 w-4 text-white/60 transition group-hover:text-white" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Card className="border border-white/15 bg-white/5 backdrop-blur-2xl">
      <CardContent className="space-y-6">
        <div
          className="flex flex-wrap cursor-pointer select-none items-center justify-between gap-3"
          role="button"
          tabIndex={0}
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" /> Discover quickly
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onOpenFilters();
              }}
              className="px-3 text-xs font-semibold text-white/70 hover:text-white"
            >
              Open full filters
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
              className="px-3 text-xs font-semibold text-white/80"
              aria-label="Collapse quick filters"
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quickSorts.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onSortModeChange(item.value)}
              className={cx(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                sortMode === item.value
                  ? "border-amber-200/80 bg-amber-200/20 text-white"
                  : "border-white/20 bg-white/5 text-white/75 hover:border-white/40 hover:bg-white/10"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!!topCollections.factions.length && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              <ShieldCheck className="h-4 w-4 text-amber-200" /> Factions
            </div>
            <div className="flex flex-wrap gap-2">{topCollections.factions.map((item) => renderChip(item, "faction"))}</div>
          </div>
        )}
        {!!topCollections.locations.length && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              <MapPin className="h-4 w-4 text-amber-200" /> Locations
            </div>
            <div className="flex flex-wrap gap-2">{topCollections.locations.map((item) => renderChip(item, "locations"))}</div>
          </div>
        )}
        {!!topCollections.powers.length && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              <Atom className="h-4 w-4 text-amber-200" /> Top powers
            </div>
            <div className="flex flex-wrap gap-2">
              {topCollections.powers.map((item) => renderChip(item, "powers"))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function FilterSection({ title, values, single, activeValues, onToggle, searchTerm }) {
  const currentValues = single ? (activeValues ? [activeValues] : []) : activeValues || [];
  const filteredValues = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return values;
    return values.filter((value) => value.toLowerCase().includes(term));
  }, [values, searchTerm]);

  return (
    <div className="space-y-2">
      <div className="text-xs font-extrabold tracking-wide text-white/75">{title}</div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">
        {filteredValues.length ? (
          <div className="flex flex-wrap gap-2">
            {filteredValues.map((value) => (
              <FacetChip key={value} active={currentValues.includes(value)} onClick={() => onToggle(value)}>
                {value}
              </FacetChip>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-wide text-white/60">
            No matches
          </p>
        )}
      </div>
    </div>
  );
}

function HeroSection({
  featured,
  onOpenFilters,
  onScrollToCharacters,
  onOpenCharacter,
  onFacet,
  onToggleArena,
  onSync,
  showArena,
  characterNames = [],
}) {
  const isCompact = useMediaQuery("(max-width: 640px)");
  const heroRef = useRef(null);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const [ripples, setRipples] = useState([]);
  const rippleTimers = useRef(new Map());
  const slides = useMemo(() => {
    const base = [
      { key: "intro", label: "Menelek Makonnen Presents", data: { title: "The Loremaker Universe", blurb: "Author Menelek Makonnen opens the living universe — an ever-growing nexus of characters, factions, and cosmic forces awaiting your exploration." } },
      { key: "character", label: "Featured Character", data: featured?.character },
      { key: "faction", label: "Featured Faction", data: featured?.faction },
      { key: "location", label: "Featured Location", data: featured?.location },
      { key: "power", label: "Featured Power", data: featured?.power },
    ];
    return base.filter((slide) => slide.key === "intro" || slide.data);
  }, [featured?.character, featured?.faction, featured?.location, featured?.power]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const autoPlayed = useRef(false);
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [featureImageIndex, setFeatureImageIndex] = useState(0);
  const [featureSequence, setFeatureSequence] = useState([]);

  const tickerNames = useMemo(() => {
    const names = (characterNames || [])
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [characterNames]);

  useEffect(() => () => {
    rippleTimers.current.forEach((timeout) => clearTimeout(timeout));
    rippleTimers.current.clear();
  }, []);

  const updatePointerFromEvent = useCallback((event) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 5, 95);
    return { x, y };
  }, []);

  const registerRipple = useCallback((coords) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRipples((prev) => [...prev, { id, ...coords }]);
    const timeout = setTimeout(() => {
      rippleTimers.current.delete(id);
      setRipples((prev) => prev.filter((item) => item.id !== id));
    }, 900);
    rippleTimers.current.set(id, timeout);
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      const coords = updatePointerFromEvent(event);
      if (coords) setPointer(coords);
    },
    [updatePointerFromEvent]
  );

  const handlePointerLeave = useCallback(() => {
    setPointer({ x: 50, y: 50 });
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      const coords = updatePointerFromEvent(event);
      if (coords) {
        setPointer(coords);
        registerRipple(coords);
      }
    },
    [registerRipple, updatePointerFromEvent]
  );

  useEffect(() => {
    setIndex(0);
    autoPlayed.current = false;
  }, [featured?.character?.id, featured?.faction?.name, featured?.location?.name, featured?.power?.name]);

  useEffect(() => {
    setTickerIndex(0);
  }, [tickerNames.length]);

  useEffect(() => {
    if (!tickerNames.length) return undefined;
    const timer = setInterval(() => {
      setTickerIndex((value) => (value + 1) % tickerNames.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [tickerNames]);

  useEffect(() => {
    if (slides.length <= 1 || autoPlayed.current) return undefined;
    const timer = setTimeout(() => {
      setDirection(1);
      setIndex((prev) => (prev + 1) % slides.length);
      autoPlayed.current = true;
    }, 3600);
    return () => clearTimeout(timer);
  }, [slides.length]);

  const current = slides[index] || slides[0];

  useEffect(() => {
    if (current?.key !== "character") {
      setSnippetIndex(0);
      return undefined;
    }
    setSnippetIndex(0);
    const timer = setInterval(() => {
      setSnippetIndex((value) => value + 1);
    }, 4200);
    return () => clearInterval(timer);
  }, [current?.key, current?.data?.id]);

  useEffect(() => {
    if (current?.key !== "character") {
      setFeatureSequence([]);
      setFeatureImageIndex(0);
      return undefined;
    }
    const charData = current?.data;
    const sources = [charData?.cover, ...(charData?.gallery || [])].filter(Boolean);
    if (!sources.length) {
      setFeatureSequence([]);
      setFeatureImageIndex(0);
      return undefined;
    }
    const rng = seededRandom(`${charData.id || charData.name || "character"}|feature`);
    const order = sources.slice().sort(() => rng() - 0.5);
    const initialIndex = Math.floor(rng() * order.length);
    setFeatureSequence(order);
    setFeatureImageIndex(initialIndex);
    const timer = setInterval(() => {
      setFeatureImageIndex((value) => (value + 1) % order.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [current]);

  const goPrev = () => {
    setDirection(-1);
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % slides.length);
  };

  const activeTickerName = tickerNames[tickerIndex % Math.max(tickerNames.length, 1)] || "Lore";

  const renderCharacter = (slide) => {
    const char = slide.data;
    if (!char) {
      return (
        <div className="flex h-full flex-col justify-center gap-4 rounded-[32px] border border-white/15 bg-black/50 p-8 text-white">
          <div className="text-xs font-bold tracking-[0.35em] text-white/60">Featured Character</div>
          <p className="text-base font-semibold text-white/70 sm:text-lg">Loading today’s legend…</p>
        </div>
      );
    }
    const images = [char.cover, ...(char.gallery || [])].filter(Boolean);
    const backgroundSources = featureSequence.length ? featureSequence : images;
    const activeBackground =
      backgroundSources.length > 0
        ? backgroundSources[featureImageIndex % backgroundSources.length]
        : null;
    const topPowers = [...(char.powers || [])]
      .sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0))
      .slice(0, 3);
    const primaryLocation = (char.locations || [])[0];
    const primaryAlias = Array.isArray(char.alias) ? char.alias[0] : char.alias;
    const snippets = [
      char.shortDesc,
      char.longDesc ? `${char.longDesc.slice(0, 160).trimEnd()}${char.longDesc.length > 160 ? "…" : ""}` : null,
      topPowers[0] ? `Known for ${topPowers[0].name}` : null,
    ].filter(Boolean);
    const activeSnippet = snippets.length ? snippets[snippetIndex % snippets.length] : null;
    const openProfile = () => onOpenCharacter?.(char);
    const handleFacetClick = (event, payload) => {
      event.stopPropagation();
      if (payload?.value) onFacet?.(payload);
      openProfile();
    };
    const dossierAria = activeSnippet
      ? `Read more about ${char.name}: ${activeSnippet}`
      : `Read more about ${char.name}`;
    if (isCompact) {
      const mobileSnippet =
        activeSnippet ||
        snippets[0] ||
        char.shortDesc ||
        (char.longDesc ? `${char.longDesc.slice(0, 140).trimEnd()}${char.longDesc.length > 140 ? "…" : ""}` : "");
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={openProfile}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openProfile();
            }
          }}
          className="relative flex h-full flex-col justify-end overflow-hidden rounded-[32px] border border-white/15 bg-black/70 p-6 text-white"
        >
          {activeBackground && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${char.id || "character"}-${activeBackground}`}
                initial={{ opacity: 0.4, scale: 1.08 }}
                animate={{ opacity: 0.95, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <ImageSafe
                  src={activeBackground}
                  alt={`${char.name} spotlight`}
                  fallbackLabel={char.name}
                  className="h-full w-full object-cover object-[72%_center]"
                />
              </motion.div>
            </AnimatePresence>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-[#080d22]/72 to-[#050811]/55" />
          <div className="relative z-10 space-y-3">
            <Badge className="bg-white/15 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">{slide.label}</Badge>
            <div className="space-y-1">
              <h2 className="text-3xl font-black leading-tight">{char.name}</h2>
              {primaryAlias && <p className="text-sm font-semibold text-white/75">also known as {primaryAlias}</p>}
            </div>
            {primaryLocation && (
              <button
                type="button"
                onClick={(event) => handleFacetClick(event, { key: "locations", value: primaryLocation })}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85"
              >
                {primaryLocation}
              </button>
            )}
            {mobileSnippet && <p className="text-sm font-semibold text-white/80">{mobileSnippet}</p>}
            {topPowers[0] && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white/75">
                <Atom className="h-4 w-4" aria-hidden="true" /> {topPowers[0].name} • {topPowers[0].level}/10
              </div>
            )}
            <Button
              type="button"
              variant="gradient"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                openProfile();
              }}
              aria-label={dossierAria}
              className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
            >
              Dive into the dossier
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {!activeBackground && (
            <div className="relative z-10 mt-6 rounded-2xl border border-dashed border-white/30 bg-black/60 px-4 py-4 text-center text-xs font-semibold text-white/70">
              Classified imagery — open dossier
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={openProfile}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfile();
          }
        }}
        className="relative flex h-full flex-col justify-center overflow-hidden rounded-[32px] border border-white/15 bg-black/65 p-8 text-white lg:p-12"
      >
        {activeBackground && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${char.id || "character"}-${activeBackground}`}
              initial={{ opacity: 0.45, scale: 1.06 }}
              animate={{ opacity: 0.95, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <ImageSafe
                src={activeBackground}
                alt={`${char.name} backdrop`}
                fallbackLabel={char.name}
                className="h-full w-full object-cover object-[74%_center] lg:object-[68%_center]"
              />
            </motion.div>
          </AnimatePresence>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-[#080d22]/70 to-[#050811]/45" />
        <div className="relative z-10 flex max-w-4xl flex-col gap-6">
          <Badge className="w-max bg-white/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
            {slide.label}
          </Badge>
          <div className="space-y-3">
            <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl xl:text-6xl">{char.name}</h2>
            {primaryAlias && <p className="text-base font-semibold text-white/80">Alias: {primaryAlias}</p>}
          </div>
          <p className="max-w-3xl text-base font-semibold text-white/80 lg:text-lg">
            {activeSnippet || char.shortDesc || char.longDesc?.slice(0, 220) || "A legend awaits their tale to be told."}
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
            {char.gender && (
              <FacetChip onClick={(event) => handleFacetClick(event, { key: "gender", value: char.gender })}>
                {char.gender}
              </FacetChip>
            )}
            {primaryLocation && (
              <FacetChip onClick={(event) => handleFacetClick(event, { key: "locations", value: primaryLocation })}>
                {primaryLocation}
              </FacetChip>
            )}
            {(char.faction || []).map((faction) => (
              <FacetChip key={faction} onClick={(event) => handleFacetClick(event, { key: "faction", value: faction })}>
                {faction}
              </FacetChip>
            ))}
          </div>
          {!!topPowers.length && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/75">
                <Atom size={16} aria-hidden="true" /> Top powers
              </div>
              <div className="flex flex-wrap gap-2">
                {topPowers.map((power) => (
                  <button
                    key={power.name}
                    type="button"
                    onClick={(event) => handleFacetClick(event, { key: "powers", value: power.name })}
                    className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wide text-white/90 transition hover:bg-white/20"
                  >
                    {power.name} • {power.level}/10
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="gradient"
              size="md"
              onClick={(event) => {
                event.stopPropagation();
                openProfile();
              }}
              aria-label={dossierAria}
              className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-sm font-semibold shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
            >
              Dive into the dossier
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        {!activeBackground && (
          <div className="relative z-10 mt-6 rounded-2xl border border-dashed border-white/30 bg-black/55 px-4 py-5 text-center text-xs font-semibold text-white/70 sm:text-sm">
            Classified imagery — open dossier
          </div>
        )}
      </div>
    );
  };

  const renderIntro = (slide) => {
    const title = slide.data?.title || "The Loremaker Universe";
    const blurb =
      slide.data?.blurb ||
      "Step beyond the veil into Menelek Makonnen’s ever-expanding universe where every dossier unlocks new connections.";
    const orbits = [
      { inset: "6%", duration: 28, delay: 0, dotClass: "bg-amber-300" },
      { inset: "18%", duration: 34, delay: 0.6, dotClass: "bg-fuchsia-300" },
      { inset: "30%", duration: 40, delay: 1.1, dotClass: "bg-indigo-300" },
    ];
    if (isCompact) {
      return (
        <div className="relative flex h-full flex-col justify-between rounded-[32px] border border-white/15 bg-black/60 p-6 text-white">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-white/80">{slide.label}</div>
            <h2 className="text-2xl font-black leading-snug text-balance">{title}</h2>
            <p className="text-sm font-semibold text-white/75">{blurb}</p>
          </div>
          <Button
            variant="gradient"
            size="md"
            onClick={onScrollToCharacters}
            className="self-start shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
          >
            Discover the Universe
          </Button>
        </div>
      );
    }
    return (
      <div className="relative flex h-full flex-col overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-black/70 via-indigo-900/60 to-fuchsia-700/45 p-8 text-white md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_55%)]" />
        <motion.div
          className="absolute -right-32 top-1/4 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
          animate={{ opacity: [0.25, 0.5, 0.28], scale: [1, 1.06, 0.96] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 grid flex-1 gap-8 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div className="space-y-6">
            <div className="text-sm font-semibold text-white/80">{slide.label}</div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">{title}</h2>
            <p className="max-w-xl text-sm font-semibold text-white/80 sm:text-base lg:text-lg">{blurb}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="gradient"
                size="lg"
                onClick={onScrollToCharacters}
                className="shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
              >
                Discover the Universe
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold tracking-[0.35em] text-white/70 sm:text-xs">
              <span>Daily sync across every device</span>
              <span className="hidden sm:inline">•</span>
              <span>One universe — countless stories</span>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="relative h-44 w-44 sm:h-56 sm:w-56">
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300/25 via-fuchsia-400/20 to-indigo-500/25 blur-3xl"
                animate={{ opacity: [0.2, 0.45, 0.25], scale: [0.95, 1.05, 0.98] }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-[12%] rounded-full border border-white/25"
                animate={{ rotate: 360, scale: [1, 1.03, 0.97, 1] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-[28%] rounded-full border border-white/15"
                animate={{ rotate: -360, scale: [1, 0.98, 1.02, 1] }}
                transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-[44%] rounded-full border border-white/10" />
              {orbits.map((orbit, index) => (
                <motion.div
                  key={`orbit-${index}`}
                  className="absolute rounded-full"
                  style={{ inset: orbit.inset }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: orbit.duration, repeat: Infinity, ease: "linear", delay: orbit.delay }}
                >
                  <span
                    className={cx(
                      "absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full shadow-[0_0_14px_rgba(244,244,255,0.75)]",
                      orbit.dotClass
                    )}
                  />
                </motion.div>
              ))}
              <motion.span
                className="absolute inset-0 flex items-center justify-center text-sm font-black text-white"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              >
                {activeTickerName}
              </motion.span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSlide = (slide) => {
    switch (slide.key) {
      case "intro":
        return renderIntro(slide);
      case "character":
        return renderCharacter(slide);
      case "faction":
        return (
          <RosterSlide
            slide={slide}
            icon={<Layers className="h-6 w-6" />}
            facetKey="faction"
            onFacet={onFacet}
            onOpenCharacter={onOpenCharacter}
            limit={isCompact ? 3 : 6}
          />
        );
      case "location":
        return (
          <RosterSlide
            slide={slide}
            icon={<MapPin className="h-6 w-6" />}
            facetKey="locations"
            onFacet={onFacet}
            onOpenCharacter={onOpenCharacter}
            limit={isCompact ? 3 : 6}
          />
        );
      case "power":
        return (
          <RosterSlide
            slide={slide}
            icon={<Atom className="h-6 w-6" />}
            facetKey="powers"
            onFacet={onFacet}
            onOpenCharacter={onOpenCharacter}
            limit={isCompact ? 3 : 6}
          />
        );
      default:
        return null;
    }
  };

  const heroHeightClass = isCompact ? "h-[360px]" : "h-[520px] lg:h-[560px]";

  return (
    <section
      id="hero-showcase"
      ref={heroRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#080c21]/95 shadow-[0_40px_160px_rgba(8,10,28,0.7)]"
    >
      <HeroDynamicBackground pointer={pointer} ripples={ripples} />
      <HeroHalo />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="absolute -right-20 -top-10 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-none flex-col px-4 pb-[var(--toolbar-offset,7rem)] pt-10 sm:px-8 lg:px-16 xl:px-20 2xl:px-24">
        <header
          id="lore-header"
          className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/30 bg-black/60 px-5 py-2 backdrop-blur-3xl shadow-[0_20px_60px_rgba(8,10,26,0.55)]"
        >
          <div className="flex items-center gap-3">
            <LoreShield onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
            <div className="flex flex-col gap-1 text-xs font-semibold text-white/80 sm:text-sm">
              <span className="hidden sm:inline">Pulse of the Loremaker</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-white/35 px-3 py-1 text-white transition hover:bg-white/10"
                >
                  Loremaker
                </button>
                <Button
                  as="a"
                  href="https://menelekmakonnen.com"
                  target="_blank"
                  rel="noreferrer"
                  variant="subtle"
                  size="sm"
              className="px-3 py-1 text-xs font-semibold text-white/85"
            >
              Menelek Makonnen
            </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-3"
              onClick={onOpenFilters}
              aria-label="Open filters"
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs font-semibold">Filters</span>
            </Button>
            <Button
              variant={showArena ? "subtle" : "ghost"}
              size="sm"
              className="flex items-center gap-2 px-3"
              onClick={onToggleArena}
              aria-label={showArena ? "Hide arena" : "Open arena"}
              aria-pressed={showArena}
            >
              <Swords className="h-4 w-4" />
              <span className="text-xs font-semibold">Arena</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-3"
              onClick={onSync}
              aria-label="Sync universe"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="text-xs font-semibold">Sync</span>
            </Button>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2 px-4 text-sm font-semibold"
              onClick={onOpenFilters}
              aria-label="Open filters"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span>Launch filters</span>
            </Button>
            <Button
              variant={showArena ? "subtle" : "ghost"}
              size="sm"
              className={cx(
                "inline-flex items-center gap-2 px-4 text-sm font-semibold",
                showArena ? "border border-amber-200/60 bg-amber-200/20" : ""
              )}
              onClick={onToggleArena}
              aria-label={showArena ? "Hide arena" : "Open arena"}
              aria-pressed={showArena}
            >
              <Swords className="h-4 w-4" aria-hidden="true" />
              <span>{showArena ? "Hide arena" : "Battle arena"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2 px-4 text-sm font-semibold"
              onClick={onSync}
              aria-label="Sync universe"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <span>Sync</span>
            </Button>
          </div>
        </header>
        <div className="mt-10 flex flex-1 flex-col gap-10 sm:mt-14">
          <div className="flex flex-col gap-3 text-sm font-semibold tracking-[0.18em] text-white/70 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-white">
              <Clock size={12} /> {todayKey()} • Daily lore sequence
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Sparkles className="hidden h-4 w-4 sm:inline" />
              <span className="text-xs sm:text-sm">Curated highlights from across the cosmos</span>
            </div>
          </div>
          <div className="flex flex-1 items-center">
            <div
              className={cx(
                "relative w-full overflow-hidden rounded-[36px] border border-white/15 bg-black/60 shadow-[0_40px_120px_rgba(12,9,32,0.55)]",
                heroHeightClass
              )}
            >
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white shadow-lg transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 sm:h-12 sm:w-12"
                    aria-label="Previous highlight"
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white shadow-lg transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 sm:h-12 sm:w-12"
                    aria-label="Next highlight"
                  >
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </>
              )}
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={current?.key}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 140 : -140 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -140 : 140 }}
                  transition={{ duration: 0.85, ease: "easeInOut" }}
                  className="relative h-full"
                >
                  {renderSlide(current)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4 pb-6 text-sm font-semibold text-white/75">
            <Users className="h-4 w-4" />
            <span>There's more.</span>
            <Button
              variant="gradient"
              size="lg"
              onClick={onOpenFilters}
              className="shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
            >
              Launch filters
            </Button>
          </div>
        </div>
      </div>
      <div
        id="hero-toolbar-mount"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-16 sm:px-8 lg:px-16 xl:px-20 2xl:px-24"
      />
    </section>
  );
}

/** -------------------- Page -------------------- */
export default function LoremakerApp({ initialCharacters = [], initialError = null }) {
  const { data, loading, error, refetch } = useCharacters(initialCharacters, initialError);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [combineAND, setCombineAND] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const [arenaSlots, setArenaSlots] = useState({ left: null, right: null });
  const [arenaPulseKey, setArenaPulseKey] = useState(0);
  const [highlightedId, setHighlightedId] = useState(null);
  const [showArena, setShowArena] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [modalIndex, setModalIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transferNotices, setTransferNotices] = useState([]);
  const sortedRef = useRef([]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const slugify = useCallback(
    (value) =>
      (value || "")
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, ""),
    []
  );

  const selectedIds = useMemo(
    () => [arenaSlots.left, arenaSlots.right].filter(Boolean),
    [arenaSlots.left, arenaSlots.right]
  );

  const openCharacter = useCallback((char) => {
    if (!char) return;
    const arr = sortedRef.current || [];
    const idx = arr.findIndex((item) => item.id === char.id);
    setModalIndex(idx);
    setCurrentCharacter(char);
    setOpenModal(true);
  }, []);

  const closeCharacter = useCallback(() => {
    setOpenModal(false);
    setCurrentCharacter(null);
    setModalIndex(-1);
  }, []);

  const handleFacet = useCallback(({ key, value }) => {
    setFilters((prev) => {
      const next = new Set(prev[key] || []);
      next.add(value);
      return { ...prev, [key]: Array.from(next) };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setCombineAND(false);
    setQuery("");
    setArenaSlots({ left: null, right: null });
    setHighlightedId(null);
  }, []);

  const focusArena = useCallback(() => {
    document.getElementById("arena-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onUseInSim = useCallback((character, rect) => {
    if (!character) return;
    const id = character.id;
    setArenaSlots((slots) => {
      if (slots.left === id || slots.right === id) return slots;
      if (!slots.left) {
        return { left: id, right: slots.right };
      }
      if (!slots.right) {
        return { left: slots.left, right: id };
      }
      return { left: slots.right, right: id };
    });
    setArenaPulseKey((key) => key + 1);
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(null), 900);
    if (rect && typeof window !== "undefined") {
      const key = `${id}-${Date.now()}`;
      const notice = {
        key,
        name: character.name,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      };
      setTransferNotices((items) => [...items, notice]);
      setTimeout(() => {
        setTransferNotices((items) => items.filter((item) => item.key !== key));
      }, 1400);
    }
    setShowArena(true);
    setTimeout(focusArena, 80);
  }, [focusArena]);

  const useInSim = useCallback(
    (char) => {
      onUseInSim(char);
      closeCharacter();
    },
    [closeCharacter, onUseInSim]
  );

  const navigateCharacter = useCallback(
    (delta) => {
      const arr = sortedRef.current;
      if (!arr.length) return;
      setModalIndex((prev) => {
        let index = prev;
        if (index < 0 && currentCharacter) {
          index = arr.findIndex((item) => item.id === currentCharacter.id);
        }
        if (index < 0) return prev;
        const nextIndex = (index + delta + arr.length) % arr.length;
        const next = arr[nextIndex];
        if (next) {
          setCurrentCharacter(next);
          setOpenModal(true);
          return nextIndex;
        }
        return prev;
      });
    },
    [currentCharacter]
  );

  const toggleArena = useCallback(() => {
    setShowArena((prev) => {
      const next = !prev;
      if (!prev) {
        setTimeout(focusArena, 80);
      }
      return next;
    });
  }, [focusArena]);

  const closeArena = useCallback(() => {
    setShowArena(false);
  }, []);

  const filtered = useMemo(
    () => data.filter((c) => matchesFilters(c, filters, combineAND, query)),
    [data, filters, combineAND, query]
  );

  const hasActiveFilters = useMemo(() => {
    if (query.trim()) return true;
    if (combineAND) return true;
    return Object.values(filters || {}).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });
  }, [filters, query, combineAND]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "random":
        return arr.sort(() => Math.random() - 0.5);
      case "faction":
        return arr.sort((a, b) => String(a.faction?.[0] || "").localeCompare(String(b.faction?.[0] || "")));
      case "az":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "za":
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case "most":
        return arr.sort((a, b) => scoreCharacter(b) - scoreCharacter(a));
      case "least":
        return arr.sort((a, b) => scoreCharacter(a) - scoreCharacter(b));
      default:
        return arr;
    }
  }, [filtered, sortMode]);

  useEffect(() => {
    sortedRef.current = sorted;
  }, [sorted]);

  const featured = useMemo(() => computeFeatured(data), [data]);
  const universeNames = useMemo(() => data.map((c) => c.name).filter(Boolean), [data]);
  const siteUrl = useMemo(() => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app";
    return envUrl.replace(/\/$/, "");
  }, []);
  const previewImage = useMemo(() => {
    for (const char of data) {
      if (char?.cover) return char.cover;
      if (Array.isArray(char?.gallery) && char.gallery.length) return char.gallery[0];
    }
    return null;
  }, [data]);
  const keywordList = useMemo(() => {
    const terms = new Set();
    data.forEach((char) => {
      if (char.name) terms.add(`${char.name} lore`);
      if (Array.isArray(char.alias) && char.alias.length) terms.add(`${char.alias[0]} character`);
      (char.faction || []).forEach((faction) => faction && terms.add(`${faction} faction`));
      (char.locations || []).forEach((loc) => loc && terms.add(`${loc} heroes`));
      (char.powers || []).forEach((power) => {
        if (power?.name) terms.add(`${power.name} powers`);
      });
    });
    return Array.from(terms).slice(0, 40).join(", ");
  }, [data]);
  const metaDescription = useMemo(() => {
    const count = data.length;
    const heroName = featured?.character?.name;
    const heroLocale = featured?.character?.locations?.[0];
    const base = `Explore ${count || "dozens of"} characters, factions, and powers inside Menelek Makonnen's LoreMaker Universe.`;
    const highlight = heroName ? ` Spotlight on ${heroName}${heroLocale ? ` of ${heroLocale}` : ""}.` : "";
    return `${base}${highlight}`.trim();
  }, [data.length, featured?.character?.name, featured?.character?.locations]);

  useEffect(() => {
    if (!openModal || !currentCharacter) return;
    const arr = sortedRef.current;
    if (!arr.length) {
      closeCharacter();
      return;
    }
    const idx = arr.findIndex((item) => item.id === currentCharacter.id);
    if (idx === -1) {
      closeCharacter();
      return;
    }
    setModalIndex(idx);
    const latest = arr[idx];
    if (latest && latest !== currentCharacter) {
      setCurrentCharacter(latest);
    }
  }, [openModal, currentCharacter, closeCharacter]);
  const schemaJson = useMemo(() => {
    const clean = (value) => {
      if (Array.isArray(value)) {
        const arr = value.map((item) => clean(item)).filter((item) => {
          if (item == null) return false;
          if (Array.isArray(item)) return item.length > 0;
          if (typeof item === "object") return Object.keys(item).length > 0;
          return true;
        });
        return arr.length ? arr : null;
      }
      if (value && typeof value === "object") {
        const obj = Object.fromEntries(
          Object.entries(value)
            .map(([key, val]) => [key, clean(val)])
            .filter(([, val]) => val != null)
        );
        return Object.keys(obj).length ? obj : null;
      }
      return value ?? null;
    };

    const graph = [];
    if (!data.length) {
      graph.push(
        clean({
          "@type": "Organization",
          "@id": `${siteUrl}#organization`,
          name: "LoreMaker Universe",
          url: siteUrl,
          founder: { "@type": "Person", name: "Menelek Makonnen", url: "https://menelekmakonnen.com" },
        })
      );
      return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
    }

    const limit = Math.min(120, data.length);
    const characters = data
      .slice(0, limit)
      .map((char) => {
        const slug = char.id || slugify(char.name);
        const url = `${siteUrl}/characters/${slug}`;
        const alias = Array.isArray(char.alias) ? char.alias.filter(Boolean) : [];
        const factions = (char.faction || []).filter(Boolean);
        const locations = (char.locations || []).filter(Boolean);
        const powers = (char.powers || []).map((power) => power?.name).filter(Boolean);
        return clean({
          "@type": "FictionalCharacter",
          "@id": url,
          url,
          name: char.name,
          alternateName: alias.length > 1 ? alias : alias[0],
          description: char.shortDesc || char.longDesc,
          image: char.cover || char.gallery?.[0],
          knowsAbout: powers,
          workLocation: locations.map((loc) => clean({ "@type": "Place", name: loc })),
          memberOf: factions.map((fac) => clean({ "@type": "Organization", name: fac })),
        });
      })
      .filter(Boolean);

    graph.push(
      clean({
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "LoreMaker Universe",
        url: siteUrl,
        founder: { "@type": "Person", name: "Menelek Makonnen", url: "https://menelekmakonnen.com" },
        member: characters.slice(0, 50).map((char) => clean({ "@id": char["@id"], name: char.name })),
      })
    );

    graph.push(
      clean({
        "@type": "ItemList",
        "@id": `${siteUrl}#codex`,
        name: "LoreMaker Codex",
        numberOfItems: characters.length,
        itemListOrder: "http://schema.org/ItemListOrderAscending",
        itemListElement: characters.map((char, index) =>
          clean({
            "@type": "ListItem",
            position: index + 1,
            url: char?.url,
            name: char?.name,
          })
        ),
      })
    );

    graph.push(...characters);

    const pruned = graph.filter((node) => node && Object.keys(node).length > 0);
    return JSON.stringify({ "@context": "https://schema.org", "@graph": pruned });
  }, [data, siteUrl, slugify]);

  const handleRandomCharacter = useCallback(() => {
    if (!sorted.length) return;
    const random = sorted[Math.floor(Math.random() * sorted.length)];
    if (!random) return;
    setHighlightedId(random.id);
    setTimeout(() => setHighlightedId(null), 1200);
    document.getElementById("characters-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    openCharacter(random);
  }, [sorted, openCharacter]);

  const scrollToCharacters = useCallback(() => {
    document.getElementById("characters-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <Head>
        <title>LoreMaker Universe Codex | Menelek Makonnen</title>
        <meta name="description" content={metaDescription} />
        {keywordList && <meta name="keywords" content={keywordList} />}
        <meta name="author" content="Menelek Makonnen" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={siteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="LoreMaker Universe Codex | Menelek Makonnen" />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={siteUrl} />
        {previewImage && <meta property="og:image" content={previewImage} />}
        <meta property="og:site_name" content="LoreMaker Universe" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="LoreMaker Universe Codex | Menelek Makonnen" />
        <meta name="twitter:description" content={metaDescription} />
        {previewImage && <meta name="twitter:image" content={previewImage} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />
      </Head>
      <div className="relative min-h-screen w-full overflow-x-hidden bg-[#050813] text-white">
      <CosmicBackdrop />
      <Aurora className="opacity-70" />
      <AnimatePresence>
        {transferNotices.map((notice) => (
          <motion.div
            key={notice.key}
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pointer-events-none fixed z-50 flex items-center justify-center"
            style={{
              top: notice.top,
              left: notice.left,
              width: notice.width,
              height: notice.height,
            }}
          >
            <div className="rounded-3xl border border-amber-300/60 bg-black/80 px-4 py-3 text-center text-xs font-black tracking-[0.35em] text-amber-200 shadow-[0_12px_40px_rgba(253,230,138,0.35)]">
              Moved to Battle Arena
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <main className="pb-12 pt-0">
        <HeroSection
          featured={featured}
          onOpenFilters={() => setFiltersOpen(true)}
          onScrollToCharacters={scrollToCharacters}
          onOpenCharacter={openCharacter}
          onFacet={handleFacet}
          onToggleArena={toggleArena}
          onSync={refetch}
          showArena={showArena}
          characterNames={universeNames}
        />
        <ToolsBar
          query={query}
          onQueryChange={setQuery}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onOpenFilters={() => setFiltersOpen(true)}
          onClearFilters={clearFilters}
          onArenaToggle={toggleArena}
          onSync={refetch}
          showArena={showArena}
          totalCount={data.length}
          filteredCount={filtered.length}
          hasActiveFilters={hasActiveFilters}
        />
        <div className="mx-auto max-w-7xl space-y-10 px-3 pt-6 sm:px-4">
          {loading && (
            <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white/80">
              Synchronising the universe…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-3xl border border-red-400/40 bg-red-500/10 px-6 py-4 text-sm font-semibold text-red-200">
              {error}
            </div>
          )}
          {showArena && (
            <div id="arena-anchor" className="mt-10 scroll-mt-40">
              <BattleArena
                characters={sorted}
                slots={arenaSlots}
                setSlots={setArenaSlots}
                onOpenCharacter={openCharacter}
                pulseKey={arenaPulseKey}
                onClose={closeArena}
              />
            </div>
          )}

          {!showArena && (
            <QuickFilterRail
              data={sorted}
              onFacet={handleFacet}
              onSortModeChange={setSortMode}
              sortMode={sortMode}
              onOpenFilters={() => setFiltersOpen(true)}
            />
          )}

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/70">
              <Users size={14} /> {filtered.length} heroes ready
            </div>
          </section>

          <div id="characters-grid" className="mt-6 scroll-mt-40">
            <CharacterGrid
              data={sorted.filter((c) => !selectedIds.includes(c.id))}
              onOpen={openCharacter}
              onFacet={handleFacet}
              onUseInSim={onUseInSim}
              highlightId={highlightedId}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/50 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-3 py-10 sm:px-4">
          <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <p className="text-xs font-black tracking-[0.35em] text-white/70">LoreMaker Universe</p>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-white/60">
                © {currentYear} Menelek Makonnen.
              </p>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-white/60">
                All characters, stories, lore, and artwork from the LoreMaker Universe are protected by copyright.
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-black tracking-[0.35em] text-white/70">Explore</p>
              <div className="flex flex-col gap-2">
                <Button
                  as="a"
                  href="#arena-anchor"
                  variant="subtle"
                  size="sm"
                  className="justify-start gap-2 px-4 text-[10px] tracking-[0.3em]"
                >
                  <Swords className="h-4 w-4" aria-hidden="true" />
                  Battle Arena
                </Button>
                <Button
                  type="button"
                  onClick={handleRandomCharacter}
                  variant="subtle"
                  size="sm"
                  className="justify-start gap-2 px-4 text-[10px] tracking-[0.3em]"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Random Character
                </Button>
                <Button
                  as="a"
                  href="#characters-grid"
                  variant="subtle"
                  size="sm"
                  className="justify-start gap-2 px-4 text-[10px] tracking-[0.3em]"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Character Archive
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-black tracking-[0.35em] text-white/70">Connect</p>
              <div className="flex flex-col gap-2">
                <Button
                  as="a"
                  href="https://menelekmakonnen.com"
                  target="_blank"
                  rel="noreferrer"
                  variant="subtle"
                  size="sm"
              className="justify-start gap-2 px-4 text-[10px] tracking-[0.3em]"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Menelek Makonnen
            </Button>
                <Button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 px-4 text-[10px] tracking-[0.3em] text-white/70 hover:text-white"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  Back to Top
                </Button>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <CharacterModal
        open={openModal}
        onClose={closeCharacter}
        char={currentCharacter}
        onNavigate={navigateCharacter}
        onFacet={handleFacet}
        onUseInSim={useInSim}
      />

        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)}>
          <SidebarFilters
            data={data}
            filters={filters}
            setFilters={setFilters}
            combineAND={combineAND}
            setCombineAND={setCombineAND}
            onClear={clearFilters}
          />
        </FilterDrawer>

        <ScrollShortcuts />
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const characters = await fetchCharactersFromSheets();
    return {
      props: {
        initialCharacters: characters,
        initialError: null,
      },
      revalidate: 600,
    };
  } catch (error) {
    console.error("[characters] Failed to load initial characters", error);
    return {
      props: {
        initialCharacters: [],
        initialError: publicCharactersError(error),
      },
      revalidate: 300,
    };
  }
}
