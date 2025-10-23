import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Filter,
  Users,
  MapPin,
  Layers,
  Atom,
  Clock,
  Library,
  Crown,
  Swords,
} from "lucide-react";

/**
 * Ultra interactive Loremaker experience
 * - Loads characters from Google Sheets (GViz)
 * - Daily seeded hero carousel + power seeding
 * - Sliding filters drawer, animated arena, chat webhook bridge
 */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Button({ variant = "solid", size = "md", className = "", children, as: Tag = "button", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 font-extrabold rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0";
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
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide", className)}>{children}</span>
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

const SHEET_ID = "1nbAsU-zNe4HbM0bBLlYofi1pHhneEjEIWfW22JODBeM";
const SHEET_NAME = "Characters";
const GVIZ_URL = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

const TRACK_VISIT_WEBHOOK =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_LOREMAKER_TRACK_WEBHOOK || ""
    : window?.__NEXT_DATA__?.props?.pageProps?.trackVisitWebhook ||
      process.env.NEXT_PUBLIC_LOREMAKER_TRACK_WEBHOOK ||
      "";

const COL_ALIAS = {
  id: ["id", "char_id", "character id", "code"],
  name: ["character", "character name", "name"],
  alias: ["alias", "aliases", "also known as"],
  gender: ["gender", "sex"],
  alignment: ["alignment"],
  location: ["location", "base of operations", "locations"],
  status: ["status"],
  era: ["era", "origin/era", "time"],
  firstAppearance: ["first appearance", "debut", "firstappearance"],
  powers: ["powers", "abilities", "power"],
  faction: ["faction", "team", "faction/team"],
  tag: ["tag", "tags"],
  shortDesc: ["short description", "shortdesc", "blurb"],
  longDesc: ["long description", "longdesc", "bio"],
  stories: ["stories", "story", "appears in"],
  cover: ["cover image", "cover", "cover url"],
};
const GALLERY_ALIASES = Array.from({ length: 15 }, (_, i) => i + 1).map((n) => [
  `gallery image ${n}`,
  `gallery ${n}`,
  `img ${n}`,
  `image ${n}`,
]);

let __SOURCE_ORDER = new Map();

const toSlug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
function normalizeDriveUrl(url) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = (match && match[1]) || u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return url;
  } catch {
    return url;
  }
}
function splitList(raw) {
  if (!raw) return [];
  return raw
    .replace(/\band\b/gi, ",")
    .replace(/[|;/]/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseLocations(raw) {
  const items = splitList(raw);
  const set = new Set();
  for (const item of items) {
    item
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((value) => set.add(value));
  }
  return Array.from(set);
}
function parsePowers(raw) {
  if (!raw) return [];
  const items = splitList(raw);
  return items.map((item) => {
    let name = item;
    let level = 0;
    const colon = item.match(/^(.*?)[=:]\s*(\d{1,2})(?:\s*\/\s*10)?$/);
    if (colon) {
      name = colon[1].trim();
      level = parseInt(colon[2], 10);
    } else if (/\((\d{1,2})\)/.test(item)) {
      const m = item.match(/^(.*?)\((\d{1,2})\)$/);
      name = (m?.[1] || item).trim();
      level = parseInt(m?.[2] || "0", 10);
    } else {
      const trail = item.match(/^(.*?)(\d{1,2})$/);
      if (trail) {
        name = trail[1].trim();
        level = parseInt(trail[2], 10);
      } else {
        name = item.trim();
      }
    }
    return { name, level: Number.isFinite(level) ? Math.min(10, Math.max(0, level)) : 0 };
  });
}
function headerMap(headers) {
  const map = {};
  const lower = headers.map((h) => (h || "").toLowerCase().trim());
  const findIndex = (aliases) => {
    for (const alias of aliases) {
      const idx = lower.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  for (const key of Object.keys(COL_ALIAS)) {
    const idx = findIndex(COL_ALIAS[key]);
    if (idx !== -1) map[key] = idx;
  }
  GALLERY_ALIASES.forEach((aliases, index) => {
    const idx = findIndex(aliases);
    if (idx !== -1) map[`gallery_${index + 1}`] = idx;
  });
  return map;
}
function parseGViz(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s);
  if (!match) throw new Error("GViz format not recognised");
  return JSON.parse(match[1]);
}
function rowToCharacter(row, map) {
  const read = (key) => {
    const idx = map[key];
    if (idx == null) return undefined;
    const cell = row[idx];
    if (!cell) return undefined;
    const value = cell.v ?? cell.f ?? cell;
    return typeof value === "string" ? value : String(value ?? "");
  };
  const name = (read("name") || "").trim();
  if (!name) return null;
  const char = {
    id: read("id") || toSlug(name),
    name,
    alias: splitList(read("alias")),
    gender: read("gender"),
    alignment: read("alignment"),
    locations: parseLocations(read("location")),
    status: read("status"),
    era: read("era"),
    firstAppearance: read("firstAppearance"),
    powers: parsePowers(read("powers")),
    faction: splitList(read("faction")),
    tags: splitList(read("tag")),
    shortDesc: read("shortDesc"),
    longDesc: read("longDesc"),
    stories: splitList(read("stories")),
    cover: normalizeDriveUrl(read("cover")),
    gallery: [],
  };
  for (let i = 1; i <= 15; i++) {
    const url = read(`gallery_${i}`);
    if (url) char.gallery.push(normalizeDriveUrl(url));
  }
  return char;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dailyInt = (seed, min = 1, max = 10) => {
  const rand = seededRandom(`${seed}|${todayKey()}`)();
  return Math.floor(rand * (max - min + 1)) + min;
};
function fillDailyPowers(c) {
  const seed = c.id || c.name || "character";
  const powers = (c.powers || []).map((p, idx) => {
    const label = p.name || `Power ${idx + 1}`;
    const base = Math.max(0, Math.min(10, Number(p.level) || 0));
    const min = base ? Math.max(3, base - 2) : 3;
    const max = base ? Math.min(10, base + 2) : 9;
    const level = dailyInt(`${seed}|${label}`, min, max);
    return { ...p, level };
  });
  return { ...c, powers };
}

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

function computeFeatured(characters) {
  if (!characters || !characters.length) {
    return { character: null, faction: null, location: null, power: null };
  }
  const rng = seededRandom(`featured|${todayKey()}`);
  const pick = (arr) => {
    if (!arr.length) return null;
    const index = Math.floor(rng() * arr.length);
    return arr[index] || arr[arr.length - 1] || null;
  };

  const character = pick(characters);
  const factions = uniqueSorted(characters.flatMap((char) => normaliseArray(char.faction)));
  const locations = uniqueSorted(characters.flatMap((char) => normaliseArray(char.locations)));
  const powers = uniqueSorted(characters.flatMap((char) => (char.powers || []).map((power) => power.name)));

  const faction = pick(factions);
  const location = pick(locations);
  const power = pick(powers);

  const factionMembers = faction
    ? characters.filter((char) => normaliseArray(char.faction).includes(faction))
    : [];
  const locationResidents = location
    ? characters.filter((char) => normaliseArray(char.locations).includes(location))
    : [];
  const powerWielders = power
    ? characters.filter((char) => (char.powers || []).some((p) => p.name === power))
    : [];

  return {
    character: character || null,
    faction: faction
      ? { name: faction, members: factionMembers.slice(0, 8) }
      : null,
    location: location
      ? { name: location, residents: locationResidents.slice(0, 8) }
      : null,
    power: power
      ? { name: power, wielders: powerWielders.slice(0, 8) }
      : null,
  };
}

function normaliseArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [value];
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

function useCharacters() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const pull = async (sheet) => {
        const res = await fetch(GVIZ_URL(sheet));
        if (!res.ok) throw new Error(`Google Sheets request failed (${res.status})`);
        const text = await res.text();
        return parseGViz(text);
      };
      let response;
      try {
        response = await pull(SHEET_NAME);
      } catch (err) {
        response = await pull("Sheet1");
      }
      const rows = response.table.rows || [];
      const labels = response.table.cols.map((col) => (col?.label || col?.id || "").trim());
      let map = headerMap(labels);
      let usableRows = rows;
      if (map.name == null && rows.length) {
        const guess = (rows[0]?.c || []).map((cell) => String(cell?.v ?? cell?.f ?? "").trim());
        const alt = headerMap(guess);
        if (alt.name != null) {
          map = alt;
          usableRows = rows.slice(1);
        }
      }
      const parsed = [];
      usableRows.forEach((row, index) => {
        const char = rowToCharacter(row.c || [], map);
        if (char) {
          parsed.push(fillDailyPowers(char));
          if (!__SOURCE_ORDER.has(char.id)) __SOURCE_ORDER.set(char.id, index);
        }
      });
      setData(parsed);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to load characters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheet();
  }, []);

  return { data, loading, error, refetch: fetchSheet };
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
            boxShadow: "0 0 6px rgba(255,255,255,0.45)",
          }}
          animate={{ opacity: [0.15, 0.75, 0.3] }}
          transition={{ duration: 4.5, delay: star.delay, repeat: Infinity, ease: "easeInOut" }}
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

function CatalogViz({ total }) {
  const segments = useMemo(() => {
    const circumference = 2 * Math.PI * 32;
    return [0.26, 0.18, 0.22, 0.14, 0.2].map((ratio, index) => ({
      key: `seg-${index}`,
      length: circumference * ratio,
      offset: (circumference * index * 0.18) % circumference,
      hue: 30 + index * 48,
    }));
  }, []);
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/25 bg-black/60 p-3 shadow-[0_12px_40px_rgba(12,18,48,0.55)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full">
          <g transform="translate(40,40)">
            {segments.map((segment, index) => (
              <motion.circle
                key={segment.key}
                r="32"
                fill="transparent"
                stroke={`hsla(${segment.hue},80%,60%,0.75)`}
                strokeWidth="4"
                strokeDasharray={`${segment.length} 200`}
                strokeDashoffset={-segment.offset}
                animate={{ strokeDashoffset: [segment.offset * -1, segment.offset * -1 - segment.length, segment.offset * -1] }}
                transition={{ duration: 14 + index * 2.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ filter: "drop-shadow(0 0 6px hsla(45,100%,75%,0.3))" }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/60">Universe</span>
          <span className="text-lg font-black text-white sm:text-xl">{total}</span>
        </div>
      </motion.div>
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
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={cx("flex items-center justify-center rounded-2xl border border-white/15 bg-white/10", className)}>
        <Insignia label={fallbackLabel} size={64} />
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setError(true)} className={className} loading="lazy" />;
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
      <div className={cx("h-full bg-gradient-to-r", gradient)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FacetChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition",
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
  useEffect(() => {
    if (!highlight) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(timer);
  }, [highlight]);
  const triggerSim = () => {
    setPulse(true);
    onUseInSim(char.id);
    setTimeout(() => setPulse(false), 700);
  };
  return (
    <motion.div
      layout
      animate={pulse ? { rotate: [0, -2, 2, -1, 1, 0], scale: [1, 1.02, 0.98, 1.01, 1] } : { rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 230, damping: 18 }}
    >
      <Card className={cx("overflow-hidden bg-white/8", highlight ? "ring-2 ring-amber-300" : "")}
        >
        <div className="relative">
          <button onClick={() => onOpen(char)} className="block h-56 w-full overflow-hidden">
            <ImageSafe
              src={char.cover || char.gallery[0]}
              alt={char.name}
              fallbackLabel={char.name}
              className="h-56 w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </button>
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            <div className="cursor-pointer" onClick={() => onOpen(char)}>
              <Insignia label={char.faction?.[0] || char.name} size={44} variant={char.faction?.length ? "faction" : "character"} />
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={triggerSim}
              className="rounded-full bg-gradient-to-r from-amber-300 to-rose-300 px-3 py-1 text-xs font-black text-black shadow-lg"
            >
              <Swords size={14} /> Simulate
            </motion.button>
          </div>
        </div>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <Insignia label={char.faction?.[0] || char.name} size={32} variant={char.faction?.length ? "faction" : "character"} />
            <CardTitle className="text-xl text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-2xl">
              <button onClick={() => onOpen(char)} className="bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-left text-transparent">
                {char.name}
              </button>
            </CardTitle>
          </div>
          <CardDescription className="line-clamp-2 text-xs text-white/80 sm:text-sm">
            {char.shortDesc || char.longDesc || "No description yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
            {char.gender && <FacetChip onClick={() => onFacet({ key: "gender", value: char.gender })}>{char.gender}</FacetChip>}
            {char.alignment && <FacetChip onClick={() => onFacet({ key: "alignment", value: char.alignment })}>{char.alignment}</FacetChip>}
            {(char.locations || []).slice(0, 2).map((loc) => (
              <FacetChip key={loc} onClick={() => onFacet({ key: "locations", value: loc })}>
                {loc}
              </FacetChip>
            ))}
            {(char.faction || []).slice(0, 1).map((faction) => (
              <FacetChip key={faction} onClick={() => onFacet({ key: "faction", value: faction })}>
                {faction}
              </FacetChip>
            ))}
          </div>
          <div className="space-y-1 text-[11px] font-bold text-white sm:text-xs">
            {(char.powers || []).slice(0, 1).map((power) => (
              <div key={power.name} className="flex items-center justify-between">
                <span className="truncate pr-2">{power.name}</span>
                <span>{power.level}/10</span>
              </div>
            ))}
            <PowerMeter level={char.powers?.[0]?.level ?? 0} />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="gradient" size="sm" className="text-[11px]" onClick={() => onOpen(char)}>
              Read <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function Gallery({ images, cover, name }) {
  const [index, setIndex] = useState(0);
  const sources = [cover, ...(images || [])].filter(Boolean);
  if (!sources.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/15 bg-white/12">
        <Insignia label={name} size={72} />
      </div>
    );
  }
  return (
    <div className="group relative">
      <ImageSafe
        src={sources[index]}
        alt={`${name} gallery ${index + 1}`}
        fallbackLabel={name}
        className="h-64 w-full rounded-2xl border border-white/12 object-cover"
      />
      {sources.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100"
            onClick={() => setIndex((i) => (i - 1 + sources.length) % sources.length)}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100"
            onClick={() => setIndex((i) => (i + 1) % sources.length)}
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {sources.map((_, idx) => (
              <span key={idx} className={cx("h-1.5 w-5 rounded-full", idx === index ? "bg-white" : "bg-white/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CharacterModal({ open, onClose, char, onFacet, onUseInSim }) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);
  if (!open || !char) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Aurora className="opacity-70" />
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-black/65 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-4 text-white">
          <div className="flex items-center gap-4">
            <Insignia label={char.name} size={48} />
            <div>
              <div className="text-3xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{char.name}</div>
              {char.era && <div className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-white/70">{char.era}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="gradient" size="sm" onClick={() => onUseInSim(char.id)}>
              Use in Sim
            </Button>
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
                <div className="text-xs font-extrabold uppercase tracking-wide text-white">Short Description</div>
                <div className="mt-1 text-white/80">{char.shortDesc || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-white">Bio</div>
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
                  <div className="text-xs font-bold uppercase tracking-wide text-white/70">Gender</div>
                  <div className="text-base font-extrabold">{char.gender}</div>
                </div>
              )}
              {char.alignment && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-white/70">Alignment</div>
                  <div className="text-base font-extrabold">{char.alignment}</div>
                </div>
              )}
              {char.status && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-white/70">Status</div>
                  <div className="text-base font-extrabold">{char.status}</div>
                </div>
              )}
              {char.firstAppearance && (
                <div className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-white/70">First Appearance</div>
                  <div className="text-base font-extrabold">{char.firstAppearance}</div>
                </div>
              )}
            </div>
            {!!(char.locations || []).length && (
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
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
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
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
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
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
function CharacterGrid({ data, onOpen, onFacet, onUseInSim, highlightId, mobileColumns = 2 }) {
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
  const mobileClass = mobileColumns >= 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={cx("grid gap-6 pb-24", mobileClass, "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}> 
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

function ArenaCard({ char, position, onRelease, onOpen, health, isWinner, showX }) {
  if (!char) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-3xl border-2 border-dashed border-slate-500/60 bg-slate-900/40 p-6 text-center text-sm font-bold text-slate-400">
        Choose combatant {position}
      </div>
    );
  }
  const [expanded, setExpanded] = useState(false);
  const healthGradient = health > 60 ? "from-emerald-300 to-emerald-500" : health > 30 ? "from-amber-300 to-amber-500" : "from-rose-400 to-red-500";
  const powers = char.powers || [];
  const visiblePowers = expanded ? powers : powers.slice(0, 4);
  const hasMorePowers = powers.length > 4;
  return (
    <motion.div
      layout
      className={cx(
        "relative h-full rounded-3xl border border-slate-700 bg-slate-950/90 p-4 text-left text-slate-100 shadow-[0_25px_80px_rgba(6,7,12,0.65)] sm:p-5",
        isWinner ? "ring-4 ring-emerald-400 scale-[1.02]" : "",
        showX ? "ring-2 ring-red-500" : ""
      )}
      animate={isWinner ? { scale: [1, 1.03, 1], boxShadow: "0 30px 80px rgba(16,185,129,0.35)" } : {}}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
    >
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className="bg-slate-800/80 text-slate-200">Combatant {position}</Badge>
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => onOpen(char)}>
            Details
          </Button>
          <Button variant="outline" size="sm" className="text-[11px]" onClick={() => onRelease(char.id)}>
            Release
          </Button>
        </div>
      </div>
      <button onClick={() => onOpen(char)} className="mt-3 block w-full text-left">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Health</div>
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
      <div className="mt-5 flex items-start gap-3">
        <ImageSafe
          src={char.cover || char.gallery[0]}
          alt={char.name}
          fallbackLabel={char.name}
          className="h-28 w-28 rounded-2xl border border-slate-700 object-cover sm:h-32 sm:w-32"
        />
        <div className="flex-1 space-y-3 text-[11px] sm:text-xs">
          <div className="text-lg font-black text-white sm:text-xl">{char.name}</div>
          <div className="grid grid-cols-2 gap-2">
            {char.gender && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Gender</div>
                <div className="text-sm font-extrabold text-white">{char.gender}</div>
              </div>
            )}
            {char.alignment && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Alignment</div>
                <div className="text-sm font-extrabold text-white">{char.alignment}</div>
              </div>
            )}
            {char.status && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</div>
                <div className="text-sm font-extrabold text-white">{char.status}</div>
              </div>
            )}
            {char.era && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Era</div>
                <div className="text-sm font-extrabold text-white">{char.era}</div>
              </div>
            )}
          </div>
          {!!(char.locations || []).length && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Locations</div>
              <div className="flex flex-wrap gap-1.5">
                {(char.locations || []).map((loc) => (
                  <Badge key={loc} className="bg-slate-800/70 text-white">
                    {loc}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {!!(char.faction || []).length && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Factions</div>
              <div className="flex flex-wrap gap-1.5">
                {(char.faction || []).map((faction) => (
                  <Badge key={faction} className="bg-slate-800/70 text-white">
                    {faction}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {!!(char.tags || []).length && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {(char.tags || []).map((tag) => (
                  <Badge key={tag} className="bg-slate-800/70 text-white">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {visiblePowers.map((power) => (
          <div key={power.name}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-200">
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
            className="w-full rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-200 transition hover:bg-slate-800"
          >
            {expanded ? "Hide extended powers" : `Reveal all ${powers.length} powers`}
          </button>
        )}
      </div>
      {!!(char.stories || []).length && (
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Stories</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-300">
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

function BattleArena({ characters, slots, setSlots, onOpenCharacter, pulseKey }) {
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

  const runRandom = () => {
    if (characters.length < 2) return;
    const rng = seededRandom(`arena|${Date.now()}`);
    const shuffled = [...characters].sort(() => rng() - 0.5);
    const first = shuffled[0];
    const second = shuffled.find((char) => char.id !== first.id) || shuffled[1];
    setSlots({ left: first?.id || null, right: second?.id || null });
  };

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
              />
            </div>
            <div className="order-3 col-span-2 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-800/60 bg-[#0f1329]/80 p-4 text-center lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-end-2 lg:self-stretch lg:justify-self-center lg:p-5">
              <motion.div
                animate={battleState}
                variants={swordVariants}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-rose-300 p-4 text-slate-900 shadow-[0_0_60px_rgba(251,191,36,0.45)]"
              >
                <Swords className="h-10 w-10" />
              </motion.div>
              <div className="flex flex-col gap-2 text-[11px] font-bold text-slate-200 sm:text-xs">
                <Button variant="outline" size="sm" onClick={runRandom} className="text-[11px]">
                  Random Duel
                </Button>
                <Button variant="gradient" size="sm" onClick={runBattle} className="text-[11px]">
                  Fight
                </Button>
                <Button variant="destructive" size="sm" onClick={reset} className="text-[11px]">
                  Reset Arena
                </Button>
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Tap combatants to view dossiers
                </span>
              </div>
            </div>
          </div>
          {timeline.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0f1329]/80 p-4 text-xs backdrop-blur">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-200">Battle Flow</div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {timeline.map((phase) => (
                  <div key={phase.round} className="rounded-xl border border-white/10 bg-[#141a38]/80 p-3 text-slate-200">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Round {phase.round}</div>
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
          {result && (
            <div className="rounded-2xl border border-white/10 bg-[#0d1126] px-4 py-5 text-center">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Winner</div>
              <div className="mt-2 rounded-xl bg-slate-900 px-4 py-3 text-lg font-black text-slate-100">
                {result.winner.name}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Final totals — {left?.name}: {result.finalScoreA} • {right?.name}: {result.finalScoreB}
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

  const Section = ({ title, values, keyName, single }) => (
    <div className="space-y-2">
      <div className="text-xs font-extrabold uppercase tracking-wide text-white/70">{title}</div>
      <div className="flex max-h-40 flex-wrap gap-2 overflow-auto pr-1">
        {values.map((value) => (
          <FacetChip key={value} active={single ? filters[keyName] === value : (filters[keyName] || []).includes(value)} onClick={() => toggle(keyName, value, !!single)}>
            {value}
          </FacetChip>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-5 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
          <Filter className="text-amber-300" /> Filters
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide">Mode</span>
          <Badge className="bg-white/10 text-white/80">{combineAND ? "AND" : "Blend"}</Badge>
          <Switch checked={combineAND} onCheckedChange={setCombineAND} />
        </div>
      </div>
      <Button variant="destructive" className="w-full" onClick={onClear}>
        Clear all
      </Button>
      <Section title="Gender / Sex" values={genders} keyName="gender" single />
      <Section title="Alignment" values={alignments} keyName="alignment" single />
      <Section title="Era" values={eras} keyName="era" />
      <Section title="Locations" values={locations} keyName="locations" />
      <Section title="Faction / Team" values={factions} keyName="faction" />
      <Section title="Powers" values={powers} keyName="powers" />
      <Section title="Tags" values={tags} keyName="tags" />
      <Section title="Status" values={statuses} keyName="status" />
      <Section title="Stories" values={stories} keyName="stories" />
    </div>
  );
}

function runDevTests() {
  if (process.env.NODE_ENV === "production") return;
  console.groupCollapsed("[Loremaker] quick sanity tests");
  console.assert(toSlug("Mystic Man!") === "mystic-man", "slug ok");
  console.assert(JSON.stringify(parseLocations("Hova, Yankopia; Afajato | and Luminae")) === JSON.stringify(["Hova", "Yankopia", "Afajato", "Luminae"]), "locations ok");
  const powers = parsePowers("Speed:8, Strength=10, Flight (9), Telepathy 7");
  console.assert(powers[0].level === 8 && powers[1].level === 10 && powers[2].level === 9 && powers[3].level === 7, "powers ok");
  const gurl = normalizeDriveUrl("https://drive.google.com/file/d/12345/view?usp=sharing");
  console.assert(gurl === "https://drive.google.com/uc?export=view&id=12345", "drive url normalised");
  console.groupEnd();
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
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#070a19] shadow-[0_40px_120px_rgba(7,10,25,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">Filters</div>
              <Button variant="ghost" onClick={onClose} className="text-xs font-bold uppercase tracking-wide text-white/80">
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


function HeroSection({
  totalCharacters,
  featured,
  onOpenFilters,
  onScrollToCharacters,
  onOpenCharacter,
  onFacet,
}) {
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

  useEffect(() => {
    setIndex(0);
    autoPlayed.current = false;
  }, [featured?.character?.id, featured?.faction?.name, featured?.location?.name, featured?.power?.name]);

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

  const goPrev = () => {
    setDirection(-1);
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % slides.length);
  };

  const renderCharacter = (slide) => {
    const char = slide.data;
    if (!char) {
      return (
        <div className="flex min-h-[260px] flex-col justify-center gap-4 rounded-[32px] border border-white/15 bg-black/50 p-8 text-white">
          <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/60">Featured Character</div>
          <p className="text-base font-semibold text-white/70 sm:text-lg">Loading today’s legend…</p>
        </div>
      );
    }
    const images = [char.cover, ...(char.gallery || [])].filter(Boolean);
    const heroImage = images[0];
    const accentImages = images.slice(1, 3);
    const topPowers = [...(char.powers || [])]
      .sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0))
      .slice(0, 3);
    const openProfile = () => onOpenCharacter?.(char);
    const handleFacetClick = (event, payload) => {
      event.stopPropagation();
      if (payload?.value) onFacet?.(payload);
      openProfile();
    };
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
        className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[32px] border border-white/15 bg-black/60 p-8 text-white lg:flex-row"
      >
        {heroImage && (
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.05, opacity: 0.6 }}
            animate={{ scale: 1.12, opacity: 0.85 }}
            transition={{ duration: 18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "saturate(1.15) brightness(0.9)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-indigo-900/70" />
        <div className="relative z-10 flex-1 space-y-5 pr-0 sm:pr-8">
          <Badge className="bg-white/15 text-white/85">{slide.label}</Badge>
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{char.name}</h2>
          <p className="text-sm font-semibold text-white/80 sm:text-base lg:text-lg">
            {char.shortDesc || char.longDesc?.slice(0, 220) || "A legend awaits their tale to be told."}
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
            {char.gender && (
              <FacetChip onClick={(event) => handleFacetClick(event, { key: "gender", value: char.gender })}>
                Gender: {char.gender}
              </FacetChip>
            )}
            {(char.faction || []).map((faction) => (
              <FacetChip key={faction} onClick={(event) => handleFacetClick(event, { key: "faction", value: faction })}>
                {faction}
              </FacetChip>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/70 sm:text-xs">
              <Atom size={14} /> Top Powers
            </div>
            <div className="flex flex-wrap gap-2">
              {topPowers.map((power) => (
                <button
                  key={power.name}
                  type="button"
                  onClick={(event) => handleFacetClick(event, { key: "powers", value: power.name })}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/90 transition hover:bg-white/20"
                >
                  {power.name} • {power.level}/10
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex flex-1 items-end justify-end gap-4 lg:mt-0 lg:flex-col">
          {accentImages.map((src, idx) => (
            <motion.div
              key={src}
              className="relative h-28 w-28 overflow-hidden rounded-2xl border border-white/20 shadow-[0_15px_40px_rgba(9,12,28,0.6)] sm:h-32 sm:w-32"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * idx, duration: 0.45 }}
              style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
            </motion.div>
          ))}
          {!accentImages.length && (
            <div className="rounded-2xl border border-dashed border-white/25 bg-black/40 px-4 py-6 text-center text-xs font-semibold text-white/70 sm:text-sm">
              Classified imagery — open dossier
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIntro = (slide) => {
    const title = slide.data?.title || "The Loremaker Universe";
    const blurb =
      slide.data?.blurb ||
      "Step beyond the veil into Menelek Makonnen’s ever-expanding universe where every dossier unlocks new connections.";
    return (
      <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-black/70 via-indigo-900/60 to-fuchsia-700/45 p-8 text-white md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_55%)]" />
        <motion.div
          className="absolute -right-32 top-1/4 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
          animate={{ opacity: [0.25, 0.5, 0.28], scale: [1, 1.06, 0.96] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div className="space-y-6">
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">{slide.label}</div>
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">{title}</h2>
            <p className="max-w-xl text-sm font-semibold text-white/80 sm:text-base lg:text-lg">{blurb}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="gradient" size="lg" onClick={onScrollToCharacters} className="shadow-[0_18px_48px_rgba(253,230,138,0.35)]">
                Discover the Universe
              </Button>
              <Button variant="outline" size="lg" onClick={onOpenFilters} className="border-white/60 text-white/90 hover:bg-white/10">
                Shape Your Lore Feed
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70 sm:text-xs">
              <span>Daily sync across every device</span>
              <span className="hidden sm:inline">•</span>
              <span>One universe — countless stories</span>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <CatalogViz total={totalCharacters} />
          </div>
        </div>
      </div>
    );
  };

  const renderRoster = (slide, icon, facetKey) => {
    const payload = slide.data;
    if (!payload?.name) {
      return (
        <div className="flex min-h-[220px] flex-col justify-center gap-3 rounded-[32px] border border-white/10 bg-white/6 p-8 text-white">
          <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">{slide.label}</div>
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
      <div className="grid gap-8 rounded-[32px] border border-white/15 bg-black/40 p-8 text-white lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.35em] text-white/70">
            {icon}
            {slide.label}
          </div>
          <h3 className="text-2xl font-black sm:text-4xl">{payload.name}</h3>
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
          {members.slice(0, 6).map((member) => (
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
  };

  const renderSlide = (slide) => {
    switch (slide.key) {
      case "intro":
        return renderIntro(slide);
      case "character":
        return renderCharacter(slide);
      case "faction":
        return renderRoster(slide, <Layers className="h-6 w-6" />, "faction");
      case "location":
        return renderRoster(slide, <MapPin className="h-6 w-6" />, "locations");
      case "power":
        return renderRoster(slide, <Atom className="h-6 w-6" />, "powers");
      default:
        return null;
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/15 bg-gradient-to-br from-indigo-900/60 via-fuchsia-700/40 to-amber-500/25 shadow-[0_40px_120px_rgba(12,9,32,0.55)]">
      <HeroHalo />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="absolute -right-20 -top-10 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-10 px-6 py-14 sm:px-10 md:px-16">
        <nav className="flex flex-col gap-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-white">
            <Clock size={12} /> {todayKey()} • Daily Lore Sequence
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="self-start rounded-full border border-white/35 px-3 py-1 text-white transition hover:bg-white/10 sm:self-auto"
          >
            Loremaker
          </button>
        </nav>

        <div className="relative">
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Previous highlight"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Next highlight"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <div className="overflow-hidden rounded-[36px]">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current?.key}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 140 : -140 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -140 : 140 }}
                transition={{ duration: 0.85, ease: "easeInOut" }}
                className="relative"
              >
                {renderSlide(current)}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-white/70">
            <span>
              {index + 1} / {slides.length} — {current?.label}
            </span>
            <div className="flex items-center gap-2">
              {slides.map((slide, idx) => (
                <button
                  key={slide.key}
                  type="button"
                  onClick={() => {
                    setDirection(idx > index ? 1 : -1);
                    setIndex(idx);
                  }}
                  className={cx(
                    "h-2 w-6 rounded-full transition",
                    idx === index ? "bg-white" : "bg-white/30 hover:bg-white/60"
                  )}
                  aria-label={`Show ${slide.label}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="gradient"
            size="lg"
            onClick={onOpenFilters}
            className="shadow-[0_18px_48px_rgba(253,230,138,0.35)]"
          >
            Launch Filters
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onScrollToCharacters}
            className="border-white/60 text-white/90 hover:bg-white/10"
          >
            Explore Universe
          </Button>
          <div className="ml-auto flex items-center gap-4 rounded-3xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 sm:text-sm">
            <CatalogViz total={totalCharacters} />
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/60">Living Codex</span>
              <span className="text-base font-black text-white sm:text-lg">{totalCharacters} Legends catalogued</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** -------------------- Page -------------------- */
export default function LoremakerApp() {
  const { data, loading, error, refetch } = useCharacters();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [combineAND, setCombineAND] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const [arenaSlots, setArenaSlots] = useState({ left: null, right: null });
  const [arenaPulseKey, setArenaPulseKey] = useState(0);
  const [highlightedId, setHighlightedId] = useState(null);
  const [showArena, setShowArena] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileColumns, setMobileColumns] = useState(2);
  const visitTracked = useRef(false);

  const selectedIds = useMemo(
    () => [arenaSlots.left, arenaSlots.right].filter(Boolean),
    [arenaSlots.left, arenaSlots.right]
  );

  const openCharacter = useCallback((char) => {
    setCurrentCharacter(char);
    setOpenModal(true);
  }, []);

  const closeCharacter = useCallback(() => {
    setOpenModal(false);
    setCurrentCharacter(null);
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

  const onUseInSim = useCallback((id) => {
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
    const anchor = document.getElementById("arena-anchor");
    if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowArena(true);
  }, []);

  const useInSim = useCallback(
    (id) => {
      onUseInSim(id);
      closeCharacter();
    },
    [closeCharacter, onUseInSim]
  );

  const filtered = useMemo(
    () => data.filter((c) => matchesFilters(c, filters, combineAND, query)),
    [data, filters, combineAND, query]
  );

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

  const featured = useMemo(() => computeFeatured(data), [data]);

  useEffect(() => {
    if (visitTracked.current) return;
    if (!TRACK_VISIT_WEBHOOK || typeof window === "undefined") return;
    if (!data.length) return;
    visitTracked.current = true;
    fetch(TRACK_VISIT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        characters: data.length,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }, [data.length]);

  const scrollToCharacters = useCallback(() => {
    document.getElementById("characters-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#050813] text-white">
      <CosmicBackdrop />
      <Aurora className="opacity-70" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center justify-between gap-3 sm:w-auto">
            <div className="flex items-center gap-3">
              <LoreShield onClick={() => window.location.reload()} />
              <div className="hidden flex-col text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60 sm:flex">
                <span>Pulse of the Loremaker</span>
                <span className="text-white/80">Daily featured lore drops</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <Button variant="ghost" size="sm" className="text-[11px] font-bold" onClick={() => setFiltersOpen(true)}>
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-[11px] font-bold" onClick={() => setShowArena((prev) => !prev)}>
                <Swords className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-[11px] font-bold" onClick={() => refetch()}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="hidden flex-1 items-center gap-3 text-[11px] font-bold uppercase tracking-[0.4em] text-white/60 sm:flex">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-white/35 px-3 py-1 text-white transition hover:bg-white/10"
            >
              Loremaker
            </button>
          </nav>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-1 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search characters, powers, locations, tags..."
                className="w-full bg-white/15 pl-9 text-sm sm:text-base"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
              <div className="relative col-span-2 sm:col-auto">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/25 bg-black/60 px-3 py-2 pr-9 text-[11px] font-bold uppercase tracking-wide text-white/80 shadow-inner backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:text-xs"
                >
                  {SORT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value} className="bg-black text-white">
                      {item.label}
                    </option>
                  ))}
                </select>
                <ArrowDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
              </div>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setFiltersOpen(true)}
                className="col-span-1 shadow-[0_15px_40px_rgba(250,204,21,0.3)] sm:col-auto"
              >
                <Filter className="h-4 w-4" /> Filters
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters} className="col-span-1 sm:col-auto">
                <X size={14} /> Clear
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setShowArena((prev) => !prev)}
                className="col-span-2 sm:col-auto"
              >
                <Swords size={14} /> {showArena ? "Hide Arena" : "Arena"}
              </Button>
              <Button variant="dark" size="sm" onClick={() => refetch()} className="col-span-2 sm:col-auto">
                <RefreshCcw size={14} /> Sync
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {loading && (
          <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white/80">
            Synchronising the universe…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 px-6 py-4 text-sm font-semibold text-red-200">
            Unable to load characters right now: {error}
          </div>
        )}

        <HeroSection
          totalCharacters={data.length}
          featured={featured}
          onOpenFilters={() => setFiltersOpen(true)}
          onScrollToCharacters={scrollToCharacters}
          onOpenCharacter={openCharacter}
          onFacet={handleFacet}
        />
        {showArena && (
          <div id="arena-anchor" className="mt-10">
            <BattleArena
              characters={sorted}
              slots={arenaSlots}
              setSlots={setArenaSlots}
              onOpenCharacter={openCharacter}
              pulseKey={arenaPulseKey}
            />
          </div>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            <Users size={14} /> {filtered.length} heroes ready
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
            <span>Mobile Density</span>
            <button
              type="button"
              onClick={() => setMobileColumns(2)}
              className={cx(
                "rounded-full border px-3 py-1 transition",
                mobileColumns === 2 ? "border-white bg-white/20 text-white" : "border-white/30 text-white/70 hover:bg-white/10"
              )}
            >
              Duo
            </button>
            <button
              type="button"
              onClick={() => setMobileColumns(3)}
              className={cx(
                "rounded-full border px-3 py-1 transition",
                mobileColumns === 3 ? "border-white bg-white/20 text-white" : "border-white/30 text-white/70 hover:bg-white/10"
              )}
            >
              Trio
            </button>
          </div>
        </section>

        <div id="characters-grid" className="mt-6">
          <CharacterGrid
            data={sorted.filter((c) => !selectedIds.includes(c.id))}
            onOpen={openCharacter}
            onFacet={handleFacet}
            onUseInSim={onUseInSim}
            highlightId={highlightedId}
            mobileColumns={mobileColumns}
          />
        </div>
      </main>

        <CharacterModal
          open={openModal}
          onClose={closeCharacter}
          char={currentCharacter}
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
  );
}
