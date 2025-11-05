import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  useLayoutEffect,
} from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Search,
  RefreshCcw,
  X,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  ArrowUpRight,
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
import ImageSafe, { characterAltText, Insignia } from "../components/image-safe";

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

function safeReleasePointerCapture(target, pointerId) {
  if (!target || typeof pointerId !== "number") return;
  const release = target.releasePointerCapture;
  if (typeof release !== "function") return;
  if (typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(pointerId)) {
    return;
  }
  try {
    release.call(target, pointerId);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Pointer capture release failed", error);
    }
  }
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normaliseSearchText(value) {
  if (value == null) return "";
  return value
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HERO_SLIDE_TRANSITION = { duration: 0.7, ease: "easeInOut" };

const HERO_SLIDE_VARIANTS = {
  enter: (direction = 1) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.98,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction = 1) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
    scale: 0.98,
  }),
};

function hasIllustration(character) {
  if (!character) return false;
  if (character.cover) return true;
  if (Array.isArray(character.gallery) && character.gallery.some(Boolean)) return true;
  return false;
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

function Card({ className = "", children, ...props }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-white/12 bg-white/8 backdrop-blur-2xl shadow-[0_25px_80px_rgba(8,8,20,0.55)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
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
    case "era": {
      const eraValues = [];
      if (character.era) eraValues.push(character.era);
      if (Array.isArray(character.eraTags)) {
        eraValues.push(...character.eraTags);
      }
      return normaliseArray(eraValues);
    }
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
  const normalizedQuery = normaliseSearchText(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);

  if (normalizedQuery) {
    const searchableParts = [
      character.id,
      character.name,
      character.identity,
      character.gender,
      character.alignment,
      character.status,
      character.era,
      (character.alias || []).join(" "),
      (character.locations || []).join(" "),
      (character.faction || []).join(" "),
      (character.tags || []).join(" "),
      (character.stories || []).join(" "),
      (character.powers || []).map((power) => power?.name).join(" "),
      character.shortDesc,
      character.longDesc,
    ]
      .map(normaliseSearchText)
      .filter(Boolean);

    const haystack = searchableParts.join(" ");
    const tokens = new Set(haystack.split(" "));
    const matchesAll = terms.every((term) => haystack.includes(term) || tokens.has(term));
    const directNameMatch = searchableParts.some((part) => part.includes(normalizedQuery));
    if (!matchesAll && !directNameMatch) {
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

function RosterSlide({ slide, icon, facetKey, onFacet, onOpenCharacter, limit, background }) {
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
    <div className="relative flex h-full w-full flex-col justify-center overflow-hidden text-white">
      <div className="absolute inset-0 bg-black/60" />
      {background && (
        <div className="absolute inset-0 overflow-hidden">
          <ImageSafe
            src={background}
            alt={characterAltText(payload.name)}
            fallbackLabel={payload.name}
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-[#080d22]/75 to-[#050811]/45" />
        </div>
      )}
      <div className="relative z-10 grid h-full gap-8 px-8 py-10 backdrop-blur-lg lg:grid-cols-[2fr_3fr] lg:gap-12 xl:px-14">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs font-bold tracking-[0.35em] text-white/70">
            {icon}
            {slide.label}
          </div>
          <h2 className="text-2xl font-black leading-tight text-balance sm:text-4xl">{payload.name}</h2>
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
      data-hero-control="true"
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
  { value: "era", label: "By Era" },
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
  const quickFacts = [char.identity, char.gender, char.status, char.alignment, char.era]
    .filter(Boolean)
    .slice(0, 3);
  const quickFilters = [
    char.identity && { key: "identity", value: char.identity },
    char.gender && { key: "gender", value: char.gender },
    ...(char.locations || []).slice(0, 2).map((value) => ({ key: "locations", value })),
    ...(char.faction || []).slice(0, 1).map((value) => ({ key: "faction", value })),
    ...(char.eraTags || []).slice(0, 1).map((value) => ({ key: "era", value })),
    ...(char.tags || []).slice(0, 1).map((value) => ({ key: "tags", value })),
  ].filter(Boolean);
  const highlightFacts = quickFacts.slice(0, 2);
  const minimalFilters = quickFilters.slice(0, 3);
  const description = char.shortDesc || char.longDesc || "No description yet.";
  const imagePool = useMemo(() => [char.cover, ...(char.gallery || [])].filter(Boolean), [char.cover, char.gallery]);
  const poolKey = useMemo(() => JSON.stringify(imagePool), [imagePool]);
  const [baseImageIndex, setBaseImageIndex] = useState(() => (imagePool.length ? Math.floor(Math.random() * imagePool.length) : -1));
  const [hoverImageIndex, setHoverImageIndex] = useState(null);
  useEffect(() => {
    if (!imagePool.length) {
      setBaseImageIndex(-1);
      setHoverImageIndex(null);
      return;
    }
    setBaseImageIndex(Math.floor(Math.random() * imagePool.length));
    setHoverImageIndex(null);
  }, [poolKey, imagePool.length]);
  const heroImageIndex = hoverImageIndex ?? baseImageIndex;
  const heroImage = heroImageIndex >= 0 ? imagePool[heroImageIndex] : null;
  const accentLabel = (char.locations || [])[0] || char.era || char.status || "LoreMaker dossier";
  const shortCaption =
    description.length > 150 ? `${description.slice(0, 147).trimEnd()}…` : description;
  const primaryAlias = Array.isArray(char.alias) ? char.alias[0] : char.alias;
  const statusMeta = statusVisual(char.status);
  const alignmentLabel = char.alignment || "Unaligned";
  const openProfile = () => onOpen(char);
  const handleHoverIn = useCallback(() => {
    if (imagePool.length < 2) return;
    setHoverImageIndex(() => {
      let next = Math.floor(Math.random() * imagePool.length);
      if (imagePool.length > 1) {
        let guard = 0;
        while (next === baseImageIndex && guard < 6) {
          next = Math.floor(Math.random() * imagePool.length);
          guard += 1;
        }
      }
      return next;
    });
  }, [imagePool.length, imagePool, baseImageIndex]);
  const handleHoverOut = useCallback(() => {
    setHoverImageIndex(null);
  }, []);
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
          "flex h-full cursor-pointer flex-col overflow-hidden bg-black/45 backdrop-blur-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300",
          highlight ? "ring-2 ring-amber-300" : "ring-1 ring-inset ring-white/15"
        )}
        onClick={openProfile}
        onKeyDown={handleProfileKey}
        role="button"
        tabIndex={0}
        aria-label={`Open quick view for ${char.name}`}
      >
        <div className="relative">
          <div
            onMouseEnter={handleHoverIn}
            onMouseLeave={handleHoverOut}
            onPointerLeave={handleHoverOut}
            onFocus={handleHoverIn}
            onBlur={handleHoverOut}
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
                alt={characterAltText(char.name)}
                fallbackLabel={char.name}
                className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4">
                <div className="text-xs font-semibold text-white/80">{accentLabel}</div>
                <h2 className="text-lg font-black leading-tight text-white">{char.name}</h2>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
              <span>{alignmentLabel}</span>
              {statusMeta && (
                <span className="flex items-center gap-1 text-white/70">
                  <span className={cx("h-2 w-2 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </span>
              )}
            </span>
            {char.slug && (
              <Button
                as={Link}
                href={`/characters/${char.slug}`}
                variant="subtle"
                size="sm"
                onClick={(event) => event.stopPropagation()}
                className="flex items-center gap-1 px-3 text-xs font-semibold"
                aria-label={`Open the full profile for ${char.name}`}
              >
                <ArrowUpRight size={14} aria-hidden="true" />
                Full profile
              </Button>
            )}
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
        </div>
      </Card>
    </motion.div>
  );
}
function Gallery({ images, cover, name }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const pointerStart = useRef(null);
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

  const handlePointerDown = useCallback((event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target?.closest?.('[data-gallery-control]')) return;
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      origin: event.target,
      container: event.currentTarget,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerUp = useCallback(
    (event) => {
      if (!pointerStart.current) return;
      const start = pointerStart.current;
      if (start.pointerId !== event.pointerId) return;
      safeReleasePointerCapture(start.container, event.pointerId);
      pointerStart.current = null;
      if (start.origin?.closest?.('[data-gallery-control]')) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) {
          goNext();
        } else {
          goPrevious();
        }
      }
    },
    [goNext, goPrevious]
  );

  const resetPointer = useCallback((event) => {
    if (!pointerStart.current) return;
    const start = pointerStart.current;
    if (event?.pointerId && start.pointerId && event.pointerId !== start.pointerId) return;
    safeReleasePointerCapture(start.container, start.pointerId);
    pointerStart.current = null;
  }, []);

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
        className="group relative overflow-hidden rounded-[32px] border border-white/12 bg-black/40 shadow-[0_24px_80px_rgba(8,10,20,0.45)] touch-pan-y"
        data-gallery-root
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
      >
        <div className="aspect-[3/4] w-full">
          <ImageSafe
            src={activeSrc}
            alt={characterAltText(name)}
            fallbackLabel={name}
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={openLightbox}
          className="absolute inset-0 z-20 flex items-end justify-end bg-gradient-to-t from-black/45 via-black/10 to-transparent p-5 opacity-0 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 group-hover:opacity-100"
          aria-label="Open full-size gallery"
          data-gallery-control
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
              data-gallery-control
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 group-hover:opacity-100"
              onClick={goNext}
              aria-label="Next"
              data-gallery-control
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
              data-gallery-control
            >
              <X size={16} /> Close
            </button>
            <div
              className="flex max-h-[80vh] w-full max-w-4xl items-center justify-center gap-4 touch-pan-y"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={resetPointer}
              onPointerCancel={resetPointer}
              data-gallery-root
            >
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={goPrevious}
                  className="hidden rounded-full border border-white/20 bg-black/60 p-3 text-white shadow-lg transition hover:bg-black/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300 sm:inline-flex"
                  aria-label="Previous image"
                  data-gallery-control
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="relative flex-1">
                <ImageSafe
                  src={activeSrc}
                  alt={characterAltText(name)}
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
                  data-gallery-control
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
            {sources.length > 1 && (
              <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {sources.map((src, idx) => (
                  <button
                    key={src + idx}
                    type="button"
                    onClick={() => setIndex(idx)}
                    className={cx(
                      "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border",
                      idx === index
                        ? "border-amber-300/80 ring-2 ring-amber-200/60"
                        : "border-white/15 hover:border-white/40"
                    )}
                    aria-label={`View image ${idx + 1}`}
                    data-gallery-control
                  >
                    <ImageSafe
                      src={src}
                      alt={characterAltText(name)}
                      fallbackLabel={name}
                      className="h-full w-full object-cover"
                    />
                    {idx === index && <span className="absolute inset-0 border-2 border-amber-200/60" aria-hidden="true" />}
                  </button>
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
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
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
            {char.slug && (
              <Button
                as={Link}
                href={`/characters/${char.slug}`}
                variant="subtle"
                size="sm"
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold sm:text-sm"
              >
                <ArrowUpRight size={16} aria-hidden="true" />
                <span>Full Profile</span>
              </Button>
            )}
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
              {char.identity && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">Identity</div>
                  <div className="text-base font-extrabold">{char.identity}</div>
                </div>
              )}
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
              {!!(char.eraTags || []).length && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold tracking-wide text-white/70">Era</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(char.eraTags || []).map((era) => (
                      <FacetChip key={era} onClick={() => onFacet({ key: "era", value: era })}>
                        {era}
                      </FacetChip>
                    ))}
                  </div>
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
          Awaiting challenger
        </span>
        <span className="max-w-[18rem] text-xs font-semibold text-slate-400 group-hover:text-slate-100">
          Click the crossed swords icon on any character card, or tap here to randomise a challenger.
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
  const alias = Array.isArray(char.alias) ? char.alias[0] : char.alias;
  const descriptor = alias || [char.alignment, char.status].filter(Boolean).join(" • ") || char.identity || "Codex champion";
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
        <div className="flex flex-col gap-1">
          <Badge className="bg-slate-800/80 px-3 py-1 text-[10px] tracking-[0.28em] text-slate-200 sm:text-xs">
            {char.name}
          </Badge>
          <span className="text-[9px] font-semibold uppercase tracking-[0.35em] text-slate-500 sm:text-[10px]">
            {descriptor}
          </span>
        </div>
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
          alt={characterAltText(char.name)}
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
    let fighterA = left;
    let fighterB = right;
    const usedIds = [];
    if (!fighterA) {
      const candidate = pickRandomFighter([fighterB?.id]);
      if (candidate) {
        fighterA = candidate;
      }
    }
    if (fighterA?.id) {
      usedIds.push(fighterA.id);
    }
    if (!fighterB || fighterB.id === fighterA?.id) {
      const candidate = pickRandomFighter(usedIds);
      if (candidate) {
        fighterB = candidate;
      }
    }
    if (fighterB?.id && !usedIds.includes(fighterB.id)) {
      usedIds.push(fighterB.id);
    }
    if (!fighterA || !fighterB || fighterA.id === fighterB.id) return;
    setSlots((prev) => ({ ...prev, left: fighterA.id, right: fighterB.id }));
    const computed = computeBattleTimeline(fighterA, fighterB);
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

  const pickRandomFighter = useCallback(
    (exclude = []) => {
      if (!characters.length) return null;
      const blocked = new Set(exclude.filter(Boolean));
      const pool = characters.filter((char) => char?.id && !blocked.has(char.id));
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [characters]
  );

  const fillSlot = useCallback(
    (side) => {
      setSlots((prev) => {
        if (prev[side]) return prev;
        const otherSide = side === "left" ? prev.right : prev.left;
        const candidate = pickRandomFighter([otherSide]);
        if (!candidate?.id) return prev;
        return { ...prev, [side]: candidate.id };
      });
    },
    [pickRandomFighter, setSlots]
  );

  const autoFillLeft = useCallback(() => fillSlot("left"), [fillSlot]);
  const autoFillRight = useCallback(() => fillSlot("right"), [fillSlot]);

  const reshuffleSlot = useCallback(
    (side) => {
      setSlots((prev) => {
        const otherSide = side === "left" ? prev.right : prev.left;
        const current = prev[side];
        const candidate = pickRandomFighter([otherSide, current]);
        if (!candidate?.id) return prev;
        return { ...prev, [side]: candidate.id };
      });
    },
    [pickRandomFighter, setSlots]
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
  const identities = useMemo(() => uniq(data.map((item) => item.identity || "")), [data]);
  const genders = useMemo(() => uniq(data.map((item) => item.gender || "")), [data]);
  const alignments = useMemo(() => uniq(data.map((item) => item.alignment || "")), [data]);
  const locations = useMemo(() => uniq(data.flatMap((item) => item.locations || [])), [data]);
  const factions = useMemo(() => uniq(data.flatMap((item) => item.faction || [])), [data]);
  const eras = useMemo(
    () =>
      uniq(
        data.flatMap((item) => {
          const values = [];
          if (item.era) values.push(item.era);
          if (Array.isArray(item.eraTags)) values.push(...item.eraTags);
          return values;
        })
      ),
    [data]
  );
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
        title="Identity"
        values={identities}
        activeValues={filters.identity || []}
        onToggle={(value) => toggle("identity", value)}
      />
      <FilterSection
        title="Gender"
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
  const sortLabel = useMemo(() => SORT_OPTIONS.find((item) => item.value === sortMode)?.label || "Default", [sortMode]);

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
    heroEl.style.setProperty("--toolbar-offset", `${Math.ceil(height + 180)}px`);
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
                aria-label={`Cycle sort order (current: ${sortLabel})`}
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
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
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
                aria-label={`Cycle sort order (current: ${sortLabel})`}
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
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFilters}
                  className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/15 bg-white/10 p-0 text-white hover:bg-white/20"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
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
            <div className="flex flex-col gap-2">
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
                className="inline-flex h-10 flex-none items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20"
                aria-label={`Change sort order (current: ${sortLabel})`}
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                <span>Sort: {sortLabel}</span>
              </button>
                <button
                  type="button"
                  onClick={onArenaToggle}
                  className={cx(
                    "inline-flex h-10 flex-none items-center justify-center gap-1 rounded-xl border px-3 text-xs font-semibold transition",
                    showArena ? "border-amber-200/70 bg-amber-200/20 text-white" : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  )}
                  aria-label={showArena ? "Hide arena" : "Open arena"}
                  aria-pressed={showArena}
                >
                  <Swords className="h-4 w-4" aria-hidden="true" />
                  <span>Arena</span>
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenFilters}
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Open filters"
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Clear filters"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSync}
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Sync universe"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="ml-1 inline-flex flex-none items-center gap-1 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                  <Users className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                  <span>{shortCountLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={cycleDisplayMode}
                  className="ml-auto inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Show icon controls"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
              {hasActiveFilters && (
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
              )}
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
      <div className="pointer-events-none px-4 pt-4 pb-6 sm:px-8 lg:px-16 xl:px-20 2xl:px-24">
        <div className="pointer-events-auto">{renderToolbar()}</div>
      </div>,
      mountEl
    );
  } else {
    renderedToolbar = <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">{renderToolbar()}</div>;
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
  onOpenArena,
  onSync,
  showArena,
  characterNames = [],
}) {
  const isCompact = useMediaQuery("(max-width: 640px)");
  const heroRef = useRef(null);
  const visibilityRef = useRef(true);
  const [heroVisible, setHeroVisible] = useState(true);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const [ripples, setRipples] = useState([]);
  const rippleTimers = useRef(new Map());
  const slidePointer = useRef(null);
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
  const defaultSlideIndex = useMemo(() => {
    const characterIndex = slides.findIndex((slide) => slide.key === "character");
    return characterIndex >= 0 ? characterIndex : 0;
  }, [slides]);
  const [index, setIndex] = useState(defaultSlideIndex);
  const [direction, setDirection] = useState(1);
  const [initialPeek, setInitialPeek] = useState(false);
  const autoPlayed = useRef(false);
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [featureImageIndex, setFeatureImageIndex] = useState(0);
  const [featureSequence, setFeatureSequence] = useState([]);
  const autoAdvanceRef = useRef(null);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const scheduleAutoAdvance = useCallback(() => {
    clearAutoAdvance();
    if (slides.length <= 1) return;
    if (!visibilityRef.current || (typeof document !== "undefined" && document.hidden)) return;
    autoAdvanceRef.current = setInterval(() => {
      setDirection(1);
      setIndex((prev) => {
        if (slides.length <= 0) return prev;
        return (prev + 1) % slides.length;
      });
    }, 60000);
  }, [slides, clearAutoAdvance]);

  const pauseAutoAdvance = useCallback(() => {
    clearAutoAdvance();
  }, [clearAutoAdvance]);

  const backgroundSources = useMemo(() => {
    const provided = (featured?.backgrounds || []).filter(Boolean);
    if (provided.length) return provided;
    const char = featured?.character;
    if (!char) return [];
    return [char.cover, ...(char.gallery || [])].filter(Boolean);
  }, [featured?.backgrounds, featured?.character?.cover, featured?.character?.gallery, featured?.character?.id]);

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

  useEffect(() => {
    visibilityRef.current = heroVisible;
  }, [heroVisible]);

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
    if (typeof window === "undefined") return undefined;
    const node = heroRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = !!entry?.isIntersecting;
        visibilityRef.current = isVisible;
        setHeroVisible(isVisible);
        if (!isVisible) {
          clearAutoAdvance();
        } else {
          scheduleAutoAdvance();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [clearAutoAdvance, scheduleAutoAdvance]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      if (document.hidden) {
        clearAutoAdvance();
      } else if (visibilityRef.current) {
        scheduleAutoAdvance();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [clearAutoAdvance, scheduleAutoAdvance]);

  useEffect(() => {
    setIndex(defaultSlideIndex);
    autoPlayed.current = false;
    setInitialPeek(true);
    scheduleAutoAdvance();
  }, [defaultSlideIndex, scheduleAutoAdvance]);

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
      scheduleAutoAdvance();
    }, 3600);
    return () => clearTimeout(timer);
  }, [slides.length, scheduleAutoAdvance]);

  useEffect(() => {
    scheduleAutoAdvance();
    return clearAutoAdvance;
  }, [slides, scheduleAutoAdvance, clearAutoAdvance]);

  const current = slides[index] || slides[0];
  const peekActive = initialPeek && current?.key === "character";

  useEffect(() => {
    if (!initialPeek) return undefined;
    const target = slides[defaultSlideIndex];
    if (!target || target.key !== "character") {
      setInitialPeek(false);
      return undefined;
    }
    if (index !== defaultSlideIndex) {
      setInitialPeek(false);
      return undefined;
    }
    const timer = setTimeout(() => setInitialPeek(false), 1600);
    return () => clearTimeout(timer);
  }, [initialPeek, slides, defaultSlideIndex, index]);

  useEffect(() => {
    if (current?.key !== "character" || !heroVisible) {
      setSnippetIndex(0);
      return undefined;
    }
    setSnippetIndex(0);
    const timer = setInterval(() => {
      setSnippetIndex((value) => value + 1);
    }, 4200);
    return () => clearInterval(timer);
  }, [current?.key, current?.data?.id, heroVisible]);

  useEffect(() => {
    if (!backgroundSources.length) {
      setFeatureSequence([]);
      setFeatureImageIndex(0);
      return;
    }
    const seed = featured?.character?.id || featured?.character?.name || "character";
    const rng = seededRandom(`${seed}|feature`);
    const order = backgroundSources.slice();
    if (order.length > 1) {
      order.sort(() => rng() - 0.5);
    }
    setFeatureSequence(order);
    const initialIndex = order.length > 0 ? Math.floor(rng() * order.length) % order.length : 0;
    setFeatureImageIndex(initialIndex);
  }, [backgroundSources, featured?.character?.id, featured?.character?.name]);

  useEffect(() => {
    if (featureSequence.length <= 1 || !heroVisible) return undefined;
    const timer = setInterval(() => {
      setFeatureImageIndex((value) => (value + 1) % featureSequence.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [featureSequence.length, heroVisible]);

  const backgroundOrder = featureSequence.length ? featureSequence : backgroundSources;
  const sharedBackground =
    backgroundOrder.length > 0 ? backgroundOrder[featureImageIndex % backgroundOrder.length] : null;

  const heroBackdropKey = sharedBackground ? `${featureImageIndex}-${sharedBackground}` : null;

  const goPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(-1);
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
    scheduleAutoAdvance();
  }, [slides.length, scheduleAutoAdvance]);

  const goNext = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(1);
    setIndex((prev) => (prev + 1) % slides.length);
    scheduleAutoAdvance();
  }, [slides.length, scheduleAutoAdvance]);

  const activeTickerName = tickerNames[tickerIndex % Math.max(tickerNames.length, 1)] || "Lore";

  const randomizeTicker = useCallback(() => {
    if (!tickerNames.length) return;
    setTickerIndex((prev) => {
      if (tickerNames.length <= 1) return prev;
      let next = prev;
      let guard = 0;
      while (next === prev && guard < 6) {
        next = Math.floor(Math.random() * tickerNames.length);
        guard += 1;
      }
      if (next === prev) {
        return (prev + 1) % tickerNames.length;
      }
      return next;
    });
  }, [tickerNames]);

  const handleSlidePointerDown = useCallback(
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target?.closest?.('[data-hero-control]')) return;
      pauseAutoAdvance();
      slidePointer.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        container: event.currentTarget,
        rect: event.currentTarget.getBoundingClientRect(),
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [pauseAutoAdvance]
  );

  const handleSlidePointerUp = useCallback(
    (event) => {
      const start = slidePointer.current;
      if (!start || start.id !== event.pointerId) return;
      slidePointer.current = null;
      safeReleasePointerCapture(start.container, event.pointerId);
      if (event.target?.closest?.('[data-hero-control]')) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 56) {
        if (dx < 0) {
          goNext();
        } else {
          goPrev();
        }
      } else {
        const rect = start.rect || start.container?.getBoundingClientRect?.();
        if (rect?.width) {
          const relative = (event.clientX - rect.left) / rect.width;
          if (relative <= 0.1) {
            goPrev();
          } else if (relative >= 0.9) {
            goNext();
          }
        }
      }
      scheduleAutoAdvance();
    },
    [goNext, goPrev, scheduleAutoAdvance]
  );

  const handleSlidePointerCancel = useCallback(() => {
    if (!slidePointer.current) return;
    const start = slidePointer.current;
    slidePointer.current = null;
    safeReleasePointerCapture(start.container, start.id);
    scheduleAutoAdvance();
  }, [scheduleAutoAdvance]);

  const handleSlidePointerLeave = useCallback(
    (event) => {
      const start = slidePointer.current;
      if (!start) return;
      if (event.pointerId && start.id && event.pointerId !== start.id) return;
      slidePointer.current = null;
      safeReleasePointerCapture(start.container, start.id);
      scheduleAutoAdvance();
    },
    [scheduleAutoAdvance]
  );

  const renderCharacter = (slide) => {
    const char = slide.data;
    if (!char) {
      return (
        <div className="flex h-full w-full flex-col justify-center gap-4 bg-black/50 p-8 text-white">
          <div className="text-xs font-bold tracking-[0.35em] text-white/60">Featured Character</div>
          <p className="text-base font-semibold text-white/70 sm:text-lg">Loading today’s legend…</p>
        </div>
      );
    }
    const images = [char.cover, ...(char.gallery || [])].filter(Boolean);
    const activeBackground = sharedBackground || images[0] || null;
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
          className="relative flex h-full w-full cursor-pointer flex-col justify-end overflow-hidden bg-black/70 p-6 text-white"
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
                  alt={characterAltText(char.name)}
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
                data-hero-control="true"
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
            <div className="mt-2 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openProfile();
                }}
                aria-label={dossierAria}
                data-hero-control="true"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
              >
                Quick view
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                as={Link}
                href={`/characters/${char.slug}`}
                variant="subtle"
                size="sm"
                onClick={(event) => event.stopPropagation()}
                data-hero-control="true"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
              >
                Full profile
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
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
        className="relative flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden bg-black/65 p-8 text-white lg:p-12"
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
                alt={characterAltText(char.name)}
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
                    data-hero-control="true"
                    className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wide text-white/90 transition hover:bg-white/20"
                  >
                    {power.name} • {power.level}/10
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
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
              Quick view
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              as={Link}
              href={`/characters/${char.slug}`}
              variant="subtle"
              size="md"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-sm font-semibold"
            >
              Full profile
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
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
    const handleDiscover = (event) => {
      event.stopPropagation();
      onScrollToCharacters?.();
    };
    const handleArena = (event) => {
      event.stopPropagation();
      if (showArena) {
        onToggleArena?.();
      } else {
        onOpenArena?.();
      }
    };
    if (isCompact) {
      return (
        <div className="relative flex h-full flex-col justify-between bg-black/60 p-6 text-white">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-white/80">{slide.label}</div>
            <h2 className="text-2xl font-black leading-snug text-balance">{title}</h2>
            <p className="text-sm font-semibold text-white/75">{blurb}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="gradient"
              size="md"
              onClick={handleDiscover}
              data-hero-control="true"
              className="self-start shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
            >
              Discover the Universe
            </Button>
            <Button
              variant="subtle"
              size="md"
              onClick={handleArena}
              data-hero-control="true"
              className="self-start"
            >
              {showArena ? "Close Battle Arena" : "Open Battle Arena"}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-black/70 via-indigo-900/60 to-fuchsia-700/45 p-8 text-white md:p-12">
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
                onClick={handleDiscover}
                data-hero-control="true"
                className="shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
              >
                Discover the Universe
              </Button>
              <Button
                variant="subtle"
                size="lg"
                onClick={handleArena}
                className="bg-white/10"
                data-hero-control="true"
              >
                {showArena ? "Close Battle Arena" : "Open Battle Arena"}
              </Button>
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
              <motion.button
                type="button"
                className="absolute inset-0 flex cursor-pointer items-center justify-center text-sm font-black text-white focus:outline-none"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                whileTap={{ scale: 0.94 }}
                onClick={(event) => {
                  event.stopPropagation();
                  randomizeTicker();
                }}
                data-hero-control="true"
                aria-label="Show another featured legend"
              >
                {activeTickerName}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSlide = (slide) => {
    if (!slide) return null;
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
            background={sharedBackground}
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
            background={sharedBackground}
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
            background={sharedBackground}
          />
        );
      default:
        return null;
    }
  };

  const heroHeightClass = isCompact ? "min-h-[340px]" : "min-h-[580px] lg:min-h-[640px]";

  return (
    <section
      id="hero-showcase"
      ref={heroRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#080c21]/95 shadow-[0_40px_160px_rgba(8,10,28,0.7)]"
    >
      <AnimatePresence mode="wait">
        {heroBackdropKey ? (
          <motion.div
            key={heroBackdropKey}
            className="absolute inset-0 -z-20 overflow-hidden"
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            aria-hidden="true"
          >
            <ImageSafe
              src={sharedBackground}
              alt=""
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover object-[70%_center]"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-[#060b1f]/72 to-[#03050c]/85" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <HeroDynamicBackground pointer={pointer} ripples={ripples} />
      <HeroHalo />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="absolute -right-20 -top-10 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative z-10 flex min-h-screen w-full flex-col px-4 pb-[var(--toolbar-offset,9rem)] pt-10 sm:px-8 sm:pt-14 lg:px-16 xl:px-20 2xl:px-24">
        <header
          id="lore-header"
          className="relative w-full overflow-hidden rounded-[32px] border border-white/30 bg-black/40 px-6 py-4 backdrop-blur-3xl shadow-[0_24px_80px_rgba(8,10,26,0.6)]"
        >
          {sharedBackground ? (
            <>
              <ImageSafe
                src={sharedBackground}
                alt=""
                decoding="async"
                loading="eager"
                className="absolute inset-0 -z-10 h-full w-full object-cover object-[68%_center]"
                aria-hidden="true"
              />
              <div className="absolute inset-0 -z-10 bg-black/70" aria-hidden="true" />
            </>
          ) : null}
          <div className="relative z-10 flex w-full flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LoreShield onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
              <div className="flex flex-col gap-1 text-xs font-semibold text-white/80 sm:text-sm">
                <span className="hidden sm:inline">Loremaker Universe</span>
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
          </div>
        </header>
        <div className="mt-6 flex flex-1 flex-col sm:mt-10">
          <div className="flex flex-1 items-stretch">
            <div
              className={cx(
                "relative flex-1 overflow-hidden touch-pan-y -mx-4 sm:-mx-8 lg:-mx-16 xl:-mx-20 2xl:-mx-24",
                heroHeightClass
              )}
              onPointerDown={handleSlidePointerDown}
              onPointerUp={handleSlidePointerUp}
              onPointerLeave={handleSlidePointerLeave}
              onPointerCancel={handleSlidePointerCancel}
            >
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      goPrev();
                    }}
                    className="absolute inset-y-0 left-0 z-30 flex w-16 items-center justify-start bg-gradient-to-r from-black/45 via-black/10 to-transparent pl-3 text-white/70 transition hover:text-white sm:w-20"
                    aria-label="Previous highlight"
                    data-hero-control="true"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      goNext();
                    }}
                    className="absolute inset-y-0 right-0 z-30 flex w-16 items-center justify-end bg-gradient-to-l from-black/45 via-black/10 to-transparent pr-3 text-white/70 transition hover:text-white sm:w-20"
                    aria-label="Next highlight"
                    data-hero-control="true"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={current?.key}
                  custom={direction}
                  variants={HERO_SLIDE_VARIANTS}
                  initial={peekActive ? "center" : "enter"}
                  animate={peekActive ? { x: [-36, 0], opacity: 1 } : "center"}
                  exit="exit"
                  transition={peekActive ? { duration: 1.1, ease: "easeInOut" } : HERO_SLIDE_TRANSITION}
                  className="relative h-full w-full"
                >
                  {renderSlide(current)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      <div
        id="hero-toolbar-mount"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-20 sm:px-8 lg:px-16 xl:px-20 2xl:px-24"
      />
    </section>
  );
}

/** -------------------- Page -------------------- */
export default function LoremakerApp({ initialCharacters = [], initialError = null }) {
  const { data, loading, error, refetch } = useCharacters(initialCharacters, initialError);
  const router = useRouter();
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
  const processedArenaRef = useRef(null);
  const archiveRef = useRef(null);
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

  useEffect(() => {
    if (!router?.isReady) return;
    const slugParam = router.query?.arena;
    if (!slugParam) return;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
    if (!slug || processedArenaRef.current === slug) return;
    const match = data.find((char) => char.slug === slug || char.id === slug);
    if (!match?.id) return;
    processedArenaRef.current = slug;
    setArenaSlots((slots) => {
      if (slots.left === match.id) return slots;
      const nextRight = slots.right && slots.right !== match.id ? slots.right : null;
      return { left: match.id, right: nextRight };
    });
    setShowArena(true);
    setArenaPulseKey((key) => key + 1);
    setHighlightedId(match.id);
    setTimeout(() => setHighlightedId(null), 900);
    setTimeout(focusArena, 120);
  }, [router, data, focusArena]);

  useEffect(() => {
    if (!router?.isReady) return;
    const rawPrefilter = router.query?.prefilter;
    if (!rawPrefilter) return;
    const normalizeEntry = (entry) => decodeURIComponent(String(entry).trim());
    const entries = (Array.isArray(rawPrefilter) ? rawPrefilter : [rawPrefilter])
      .flatMap((value) => String(value).split(/[,;]/))
      .map(normalizeEntry)
      .filter(Boolean);
    if (!entries.length) return;

    const keyMap = {
      location: "locations",
      locations: "locations",
      base: "locations",
      faction: "faction",
      factions: "faction",
      tag: "tags",
      tags: "tags",
      power: "powers",
      powers: "powers",
      story: "stories",
      stories: "stories",
      status: "status",
      alignment: "alignment",
      gender: "gender",
      identity: "identity",
      era: "era",
      name: "name",
      alias: "alias",
      aliases: "alias",
      q: "search",
      query: "search",
      search: "search",
    };
    const singleKeys = new Set(["gender", "alignment"]);
    const arrayKeys = new Set([
      "locations",
      "faction",
      "tags",
      "powers",
      "stories",
      "status",
      "identity",
      "era",
      "alias",
    ]);
    const pendingSearch = [];

    setFilters((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        const match = entry.match(/^([^:=]+)[:=](.+)$/);
        if (!match) return;
        const rawKey = match[1].trim().toLowerCase();
        const value = match[2].trim();
        if (!value) return;
        const mapped = keyMap[rawKey] || rawKey;
        if (mapped === "search") {
          pendingSearch.push(value);
          return;
        }
        if (singleKeys.has(mapped)) {
          next[mapped] = value;
          return;
        }
        if (arrayKeys.has(mapped)) {
          const current = next[mapped];
          const existing = Array.isArray(current)
            ? new Set(current)
            : current
            ? new Set([current])
            : new Set();
          existing.add(value);
          next[mapped] = Array.from(existing);
          return;
        }
        next[mapped] = value;
      });
      return next;
    });

    if (pendingSearch.length) {
      setQuery(pendingSearch[pendingSearch.length - 1]);
    }

    setTimeout(() => {
      document.getElementById("characters-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 160);

    const nextQuery = { ...router.query };
    delete nextQuery.prefilter;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [router, router?.isReady, router?.query?.prefilter]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let detach = null;
    let cancelled = false;

    const setup = () => {
      const hero = document.getElementById("hero-showcase");
      const archive = archiveRef.current;
      if (!hero || !archive) {
        if (!cancelled) {
          requestAnimationFrame(setup);
        }
        return;
      }

      const heroWheel = (event) => {
        if (event.deltaY <= 4) return;
        const heroRect = hero.getBoundingClientRect();
        const archiveTop = archive.getBoundingClientRect().top + window.scrollY - 24;
        const heroBottom = heroRect.bottom + window.scrollY;
        if (window.scrollY + 12 >= heroBottom) return;
        event.preventDefault();
        window.scrollTo({ top: archiveTop, behavior: "smooth" });
      };

      const archiveWheel = (event) => {
        if (event.deltaY >= -4) return;
        const archiveTop = archive.getBoundingClientRect().top + window.scrollY;
        if (window.scrollY > archiveTop + 16) return;
        const heroTop = hero.getBoundingClientRect().top + window.scrollY;
        event.preventDefault();
        window.scrollTo({ top: heroTop, behavior: "smooth" });
      };

      hero.addEventListener("wheel", heroWheel, { passive: false });
      archive.addEventListener("wheel", archiveWheel, { passive: false });
      detach = () => {
        hero.removeEventListener("wheel", heroWheel);
        archive.removeEventListener("wheel", archiveWheel);
      };
    };

    setup();

    return () => {
      cancelled = true;
      if (typeof detach === "function") {
        detach();
      }
    };
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

  const openArena = useCallback(() => {
    setShowArena((prev) => {
      if (prev) return prev;
      setArenaPulseKey((key) => key + 1);
      setTimeout(focusArena, 80);
      return true;
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

  const originalOrder = useMemo(() => {
    const map = new Map();
    data.forEach((char, index) => {
      if (!char) return;
      map.set(char.id, index);
    });
    return map;
  }, [data]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const orderOf = (char) => {
      if (typeof char?.sourceIndex === "number") return char.sourceIndex;
      const fallback = originalOrder.get(char?.id);
      if (typeof fallback === "number") return fallback;
      return originalOrder.size + 1;
    };
    switch (sortMode) {
      case "random": {
        const shuffle = (list) =>
          list
            .map((item) => ({ item, score: Math.random() }))
            .sort((a, b) => a.score - b.score)
            .map(({ item }) => item);
        const illustrated = arr.filter((char) => hasIllustration(char));
        const textOnly = arr.filter((char) => !hasIllustration(char));
        return [...shuffle(illustrated), ...shuffle(textOnly)];
      }
      case "faction":
        return arr.sort((a, b) => String(a.faction?.[0] || "").localeCompare(String(b.faction?.[0] || "")));
      case "era":
        return arr.sort((a, b) => {
          const eraA = String(a.era || "").toLowerCase();
          const eraB = String(b.era || "").toLowerCase();
          if (eraA && !eraB) return -1;
          if (!eraA && eraB) return 1;
          const compare = eraA.localeCompare(eraB);
          if (compare !== 0) return compare;
          return orderOf(a) - orderOf(b);
        });
      case "az":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "za":
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case "most":
        return arr.sort((a, b) => scoreCharacter(b) - scoreCharacter(a));
      case "least":
        return arr.sort((a, b) => scoreCharacter(a) - scoreCharacter(b));
      default:
        return arr.sort((a, b) => {
          const aHas = hasIllustration(a) ? 1 : 0;
          const bHas = hasIllustration(b) ? 1 : 0;
          if (bHas !== aHas) return bHas - aHas;
          return orderOf(a) - orderOf(b);
        });
    }
  }, [filtered, sortMode, originalOrder]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyScroll = (event) => {
      if (event.defaultPrevented) return;
      if (openModal) return;
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = window.innerHeight * 0.85;
        window.scrollBy({ top: event.key === "ArrowDown" ? delta : -delta, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyScroll);
    return () => window.removeEventListener("keydown", handleKeyScroll);
  }, [openModal]);
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
        const slug = char.slug || char.id || slugify(char.name);
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
    if (typeof window === "undefined") return;
    const target = document.getElementById("characters-grid") || archiveRef.current;
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  return (
    <>
      <Head>
        <title>LoreMaker Universe: Superheroes & Fantasy Characters Codex | Menelek Makonnen</title>
        <meta name="description" content={metaDescription} />
        {keywordList && <meta name="keywords" content={keywordList} />}
        <meta name="author" content="Menelek Makonnen" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={siteUrl} />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="LoreMaker Universe: Superheroes & Fantasy Characters Codex | Menelek Makonnen"
        />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={siteUrl} />
        {previewImage && <meta property="og:image" content={previewImage} />}
        <meta property="og:site_name" content="LoreMaker Universe" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="LoreMaker Universe: Superheroes & Fantasy Characters Codex | Menelek Makonnen"
        />
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
          onOpenArena={openArena}
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
        <div ref={archiveRef} className="mx-auto max-w-7xl space-y-8 px-3 pt-4 sm:px-4">
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
