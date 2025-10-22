
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Search,
  Filter,
  Menu,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Layers,
  Atom,
  Sparkles,
  Swords,
  MessageCircle,
  Send,
  Bot,
  Home,
  BookOpen,
  Cpu,
  Newspaper,
  Instagram,
  Youtube,
  Linkedin,
  Mail,
  X,
} from "lucide-react";

/**
 * Loremaker Universe Experience — single-file build to avoid merge conflicts.
 * ---------------------------------------------------------------------------
 * Feature highlights retained:
 *  • Slide-in filter drawer (no dropdowns) with AND / ANY toggle.
 *  • Hero carousel seeded per day with deterministic picks.
 *  • Hover-only “Simulate” control that loads characters into the arena.
 *  • Arena with per-slot randomisation, dramatic winner reveal, health bars.
 *  • Animated back-to-top / bottom controls and a live chat webhook dock.
 *  • Google Sheets GViz loader with Drive image normalisation & sample fallback.
 */

// -----------------------------------------------------------------------------
// Lightweight UI primitives (no external design system)
// -----------------------------------------------------------------------------
const cx = (...classes) => classes.filter(Boolean).join(" ");

function Button({ variant = "default", className = "", children, as: Comp = "button", icon: Icon, ...props }) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  const palette = {
    default: "bg-white text-slate-900 hover:bg-amber-100",
    secondary: "bg-black/75 text-white hover:bg-black",
    outline: "border border-white/35 text-white hover:bg-white/15",
    ghost: "text-white/75 hover:text-white",
    destructive: "bg-red-600 text-white hover:bg-red-500",
  }[variant];
  return (
    <Comp className={cx(base, palette, className)} {...props}>
      {children}
      {Icon ? <Icon className="h-4 w-4" /> : null}
    </Comp>
  );
}

const IconButton = ({ icon: Icon, label, className = "", ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx(
      "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white shadow-[0_10px_35px_rgba(0,0,0,0.35)] transition hover:bg-white/20",
      className
    )}
    {...props}
  >
    <Icon className="h-5 w-5" />
  </button>
);

const Card = ({ className = "", children }) => (
  <div
    className={cx(
      "rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/20 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition",
      className
    )}
  >
    {children}
  </div>
);
const CardHeader = ({ className = "", children }) => <div className={cx("px-6 pt-6", className)}>{children}</div>;
const CardContent = ({ className = "", children }) => <div className={cx("px-6 pb-6", className)}>{children}</div>;
const CardFooter = ({ className = "", children }) => <div className={cx("px-6 pb-6", className)}>{children}</div>;
const CardTitle = ({ className = "", children }) => <h3 className={cx("text-xl font-black", className)}>{children}</h3>;
const CardDescription = ({ className = "", children }) => <p className={cx("text-sm text-white/75", className)}>{children}</p>;

const Input = ({ className = "", ...props }) => (
  <input
    className={cx(
      "w-full rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-amber-300",
      className
    )}
    {...props}
  />
);

const Badge = ({ className = "", children }) => (
  <span className={cx("inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white", className)}>
    {children}
  </span>
);

// -----------------------------------------------------------------------------
// Config & dataset helpers
// -----------------------------------------------------------------------------
const SHEET_ID = "1nbAsU-zNe4HbM0bBLlYofi1pHhneEjEIWfW22JODBeM";
const SHEET_NAME = "Characters";
const GVIZ_URL = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;

const LINKS = {
  instagram: "https://www.instagram.com/menelek.makonnen/",
  youtube: "https://www.youtube.com/@director_menelek",
  linkedin: "https://www.linkedin.com/in/menelekmakonnen/",
  email: "mailto:admin@menelekmakonnen.com",
  ai: "https://icuni.co.uk",
  blog: "https://wordpress.com/mikaelgabriel",
  loremaker: "https://menelekmakonnen.com/loremaker",
};

const CHATBOT_WEBHOOK =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_LOREMAKER_CHAT_WEBHOOK || ""
    : window?.__NEXT_DATA__?.props?.pageProps?.chatbotWebhook ||
      process.env.NEXT_PUBLIC_LOREMAKER_CHAT_WEBHOOK ||
      "";

const TRACK_VISIT_WEBHOOK =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_LOREMAKER_TRACK_WEBHOOK || ""
    : window?.__NEXT_DATA__?.props?.pageProps?.trackVisitWebhook ||
      process.env.NEXT_PUBLIC_LOREMAKER_TRACK_WEBHOOK ||
      "";

const NAV_ITEMS = [
  { key: "home", icon: Home, label: "Home", href: "/" },
  { key: "bio", icon: BookOpen, label: "Biography", href: "#biography" },
  { key: "ai", icon: Cpu, label: "AI", href: LINKS.ai, external: true },
  { key: "loremaker", icon: Sparkles, label: "Loremaker", href: LINKS.loremaker },
  { key: "blog", icon: Newspaper, label: "Blog", href: LINKS.blog, external: true },
];

const COL_ALIAS = {
  id: ["id", "char_id", "character id", "code"],
  name: ["character", "character name", "name"],
  alias: ["alias", "aliases", "aka", "also known as"],
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

const SAMPLE_CHARACTERS = [
  {
    id: "sun-warden",
    name: "Sun Warden",
    alias: ["Keeper of Dawn"],
    gender: "Female",
    alignment: "Heroic",
    locations: ["Luminae"],
    status: "Active",
    era: "Age of Shards",
    firstAppearance: "Legends of Hova #1",
    powers: [
      { name: "Solar Flare", level: 8 },
      { name: "Radiant Flight", level: 7 },
    ],
    faction: ["Order of the First Light"],
    tags: ["Mythic", "Leader"],
    shortDesc: "A solar paladin who keeps the gateways between realms stable.",
    longDesc:
      "Raised within the crystalline towers of Luminae, the Sun Warden channels ancient dawnfire to heal allies and cauterise corrupted tears.",
    stories: ["The Dawnbreak Saga"],
    cover: "https://images.unsplash.com/photo-1549045347-74c0c1b4c2ce?auto=format&fit=crop&w=900&q=80",
    gallery: [],
  },
];

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
const toSlug = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const todayKey = () => new Date().toISOString().slice(0, 10);

const seededRandom = (seed) => {
  let h = 2166136261;
  const input = String(seed);
  for (let i = 0; i < input.length; i += 1) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickDaily = (items, salt = "") => {
  if (!items.length) return null;
  const rand = seededRandom(`${todayKey()}|${salt}`);
  return items[Math.floor(rand() * items.length)] ?? items[0];
};

const splitList = (value) =>
  (value || "")
    .replace(/and/gi, ",")
    .replace(/[|;/]/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseLocations = (value) => {
  const tokens = new Set();
  splitList(value).forEach((entry) => {
    entry
      .split(/\s*,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => tokens.add(part));
  });
  return Array.from(tokens);
};

const parsePowers = (value) =>
  splitList(value).map((entry) => {
    const colon = entry.match(/^(.*?)[=:]\s*(\d{1,2})(?:\s*\/\s*10)?$/);
    const paren = entry.match(/^(.*?)\((\d{1,2})\)$/);
    const trailing = entry.match(/^(.*?)(\d{1,2})$/);
    if (colon) return { name: colon[1].trim(), level: Math.min(10, parseInt(colon[2], 10)) };
    if (paren) return { name: paren[1].trim(), level: Math.min(10, parseInt(paren[2], 10)) };
    if (trailing) return { name: trailing[1].trim(), level: Math.min(10, parseInt(trailing[2], 10)) };
    return { name: entry.trim(), level: 0 };
  });

const directDriveUrl = (id, resourceKey) => {
  const url = new URL("https://drive.google.com/uc");
  url.searchParams.set("export", "view");
  url.searchParams.set("id", id);
  if (resourceKey) url.searchParams.set("resourcekey", resourceKey);
  return url.toString();
};

const extractDriveId = (raw) => {
  try {
    const url = new URL(raw);
    if (url.hostname.includes("drive.google.com")) {
      const match = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = match?.[1] || url.searchParams.get("id") || url.searchParams.get("resid");
      const resourceKey = url.searchParams.get("resourcekey") || undefined;
      if (id) return { id, resourceKey };
    }
    if (/^lh\d+\.googleusercontent\.com$/i.test(url.hostname)) {
      return { url: url.toString() };
    }
  } catch (err) {
    return null;
  }
  return null;
};

const normalizeDriveUrl = (value) => {
  if (!value) return undefined;
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (!trimmed) return undefined;
  const extracted = extractDriveId(trimmed);
  if (extracted?.url) return extracted.url;
  if (extracted?.id) return directDriveUrl(extracted.id, extracted.resourceKey);
  return trimmed;
};

const DRIVE_REGEX = /(https?:\/\/[^\s"']*drive.google.com[^\s"']*)/gi;

const headerMap = (headers) => {
  const canonical = headers.map((header) => (header || "").toLowerCase().trim());
  const map = {};
  const findIndex = (aliases) => {
    const lower = aliases.map((alias) => alias.toLowerCase());
    for (const alias of lower) {
      const index = canonical.indexOf(alias);
      if (index !== -1) return index;
    }
    return -1;
  };
  Object.entries(COL_ALIAS).forEach(([key, aliases]) => {
    const idx = findIndex(aliases);
    if (idx !== -1) map[key] = idx;
  });
  GALLERY_ALIASES.forEach((aliases, offset) => {
    const idx = findIndex(aliases);
    if (idx !== -1) map[`gallery_${offset + 1}`] = idx;
  });
  return map;
};

const parseGViz = (text) => {
  const match = text.match(/google.visualization.Query.setResponse\((.*)\);?/s);
  if (!match) throw new Error("GViz payload not recognised");
  return JSON.parse(match[1]);
};

const rowToCharacter = (row, map) => {
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

  const character = {
    id: read("id") || toSlug(name),
    name,
    alias: splitList(read("alias")),
    gender: read("gender") || "",
    alignment: read("alignment") || "",
    locations: parseLocations(read("location")),
    status: read("status") || "",
    era: read("era") || "",
    firstAppearance: read("firstAppearance") || "",
    powers: parsePowers(read("powers")),
    faction: splitList(read("faction")),
    tags: splitList(read("tag")),
    shortDesc: read("shortDesc") || "",
    longDesc: read("longDesc") || "",
    stories: splitList(read("stories")),
    cover: normalizeDriveUrl(read("cover")),
    gallery: [],
  };

  for (let i = 1; i <= 15; i += 1) {
    const raw = read(`gallery_${i}`);
    if (raw) character.gallery.push(normalizeDriveUrl(raw));
  }

  const descriptionLinks = `${character.shortDesc}
${character.longDesc}`.match(DRIVE_REGEX) || [];
  descriptionLinks.forEach((link) => {
    const normalised = normalizeDriveUrl(link);
    if (normalised && !character.gallery.includes(normalised)) character.gallery.push(normalised);
  });

  if (!character.cover && character.gallery.length) {
    [character.cover] = character.gallery;
  }

  return character;
};

const applyDailyPowers = (character) => {
  const rand = seededRandom(`${character.name}|${todayKey()}`);
  const powers = (character.powers || []).map((power) => {
    if (power.level > 0) return power;
    const level = 4 + Math.floor(rand() * 6);
    return { ...power, level };
  });
  return { ...character, powers };
};

const SCORE_ORDER = ["god", "celestial", "alien", "mythic", "superhuman", "human"];
const scoreCharacter = (character) => {
  const base = character.powers.reduce((sum, power) => sum + (Number.isFinite(power.level) ? power.level : 0), 0);
  const tags = `${character.tags?.join(" ") || ""} ${(character.alignment || "").toLowerCase()}`.toLowerCase();
  const tier = SCORE_ORDER.findIndex((keyword) => tags.includes(keyword));
  const tierBonus = tier === -1 ? 0 : (SCORE_ORDER.length - tier) * 2;
  const factionBonus = (character.faction || []).some((faction) => /council|order|legion|pantheon/i.test(faction)) ? 3 : 0;
  return base + tierBonus + factionBonus;
};

const rngLuck = (seed, swing) => {
  const rand = seededRandom(seed);
  return Math.round(((rand() * 2 - 1) * swing));
};

// -----------------------------------------------------------------------------
// Google Sheets hook
// -----------------------------------------------------------------------------
const useCharacters = () => {
  const [state, setState] = useState({ loading: true, data: SAMPLE_CHARACTERS, error: null, updated: null });

  const fetchSheet = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const pull = async (sheetName) => {
      const res = await fetch(GVIZ_URL(sheetName), {
        cache: "no-store",
        headers: { Pragma: "no-cache", "Cache-Control": "no-store" },
      });
      if (!res.ok) throw new Error(`Google Sheets responded with ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error("Google Sheets returned an empty payload");
      return parseGViz(text);
    };

    try {
      let payload;
      try {
        payload = await pull(SHEET_NAME);
      } catch (err) {
        payload = await pull("Sheet1");
      }

      const rows = [...(payload.table.rows || [])];
      const headers = payload.table.cols.map((col) => (col?.label || col?.id || "").trim());
      let map = headerMap(headers);

      if (!map.name && rows.length) {
        const firstRow = (rows[0]?.c || []).map((cell) => String(cell?.v ?? cell?.f ?? "").trim());
        const alt = headerMap(firstRow);
        if (alt.name) {
          map = alt;
          rows.shift();
        }
      }

      const characters = rows
        .map((row) => rowToCharacter(row.c || [], map))
        .filter(Boolean)
        .map(applyDailyPowers);

      setState({ loading: false, data: characters.length ? characters : SAMPLE_CHARACTERS, error: null, updated: new Date() });
    } catch (error) {
      console.error("Failed to load Google Sheet", error);
      setState({ loading: false, data: SAMPLE_CHARACTERS, error: error?.message || "Unable to load Google Sheet", updated: null });
    }
  };

  useEffect(() => {
    fetchSheet();
  }, []);

  return { ...state, refetch: fetchSheet };
};

// -----------------------------------------------------------------------------
// Decorative layers
// -----------------------------------------------------------------------------
const Aurora = () => {
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const springX = useSpring(x, { stiffness: 60, damping: 20 });
  const springY = useSpring(y, { stiffness: 60, damping: 20 });
  const left = useTransform(springX, (value) => `${value}%`);
  const top = useTransform(springY, (value) => `${value}%`);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const nx = ((event.clientX - rect.left) / rect.width) * 100;
        const ny = ((event.clientY - rect.top) / rect.height) * 100;
        x.set(nx);
        y.set(ny);
      }}
    >
      <motion.div
        style={{ left, top }}
        className="absolute h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-fuchsia-500/35 via-amber-400/35 to-indigo-500/35 blur-3xl"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_65%)]" />
    </motion.div>
  );
};

const CosmicBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute left-1/2 top-[28%] h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-sky-500/20 via-purple-500/15 to-amber-400/20 blur-3xl" />
    <div className="absolute -left-[20%] top-1/2 h-[55vmax] w-[55vmax] -translate-y-1/2 rounded-full bg-gradient-to-tr from-amber-400/18 via-transparent to-pink-500/25 blur-3xl" />
    <div className="absolute bottom-[-20%] right-[-10%] h-[60vmax] w-[60vmax] rounded-full bg-gradient-to-tr from-indigo-500/20 via-transparent to-cyan-500/15 blur-3xl" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
  </div>
);

const LoreGlyph = ({ onRefresh, refreshing }) => (
  <motion.button
    type="button"
    onClick={onRefresh}
    aria-label="Refresh characters"
    className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-black/55 text-white shadow-[0_14px_50px_rgba(0,0,0,0.5)]"
    animate={{ boxShadow: refreshing ? "0 0 35px rgba(255,221,128,0.55)" : "0 14px 50px rgba(0,0,0,0.5)" }}
    transition={{ duration: 0.6 }}
  >
    <motion.div
      className="absolute inset-[2px] rounded-[18px] bg-[conic-gradient(from_90deg,rgba(255,255,255,0.7),rgba(255,160,64,0.5),rgba(90,34,255,0.55),rgba(255,255,255,0.7))]"
      animate={{ rotate: refreshing ? 360 : 0 }}
      transition={{ repeat: refreshing ? Infinity : 0, duration: 2.4, ease: "linear" }}
    />
    <motion.span
      className="relative z-10 text-[0.9rem] font-black tracking-[0.38em] text-white"
      animate={{ scale: refreshing ? [1, 1.1, 1] : [1, 1.04, 1], rotate: refreshing ? [0, 2, -2, 0] : [0, 0.5, -0.5, 0] }}
      transition={{ repeat: Infinity, duration: refreshing ? 0.9 : 1.8 }}
    >
      LORE
    </motion.span>
  </motion.button>
);

const NavBar = ({ onRefresh, refreshing }) => (
  <header className="sticky top-0 z-40 bg-[#05060f]/85 backdrop-blur-xl">
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 px-4 py-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <LoreGlyph onRefresh={onRefresh} refreshing={refreshing} />
        <div className="flex flex-col">
          <button
            type="button"
            className="text-left text-base font-black uppercase tracking-[0.42em] text-white/70"
            onClick={() => window.location.assign("/loremaker")}
          >
            Loremaker Universe
          </button>
          <p className="text-xs font-semibold text-white/65">
            Explore every storyline, faction, and mythic ability woven through Menelek Makonnen’s expanding cosmos.
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.key}
              as="a"
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              variant="ghost"
              className="border border-white/15 bg-white/5 text-white/85 hover:bg-white/15"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <IconButton icon={Menu} label="Menu" onClick={() => window.location.assign("/")} />
        </div>
      </div>
    </div>
  </header>
);

const Hero = ({ total }) => {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const number = new Intl.NumberFormat("en-US");
  const stats = [
    {
      label: "Live Dossiers",
      value: number.format(Math.max(1, safeTotal)),
      detail: "ready for review",
    },
    {
      label: "Arena Matchups",
      value: number.format(Math.max(24, safeTotal * Math.max(safeTotal - 1, 1))),
      detail: "possible outcomes",
    },
    {
      label: "Narratives Indexed",
      value: number.format(Math.max(18, safeTotal * 3)),
      detail: "story arcs & chronicles",
    },
  ];

  return (
    <section className="relative mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-8 text-white shadow-[0_20px_90px_rgba(0,0,0,0.55)]">
      <Aurora />
      <div className="relative z-10 space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Loremaker Universe Vault</h1>
          <p className="max-w-2xl text-base font-semibold text-white/85 sm:text-lg">
            Explore every storyline, faction, and mythic ability woven through Menelek Makonnen’s expanding cosmos. Filter the archive,
            dive into cinematic dossiers, and summon characters into the Arena.
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-amber-400/20 text-amber-100">
              {safeTotal} character{safeTotal === 1 ? "" : "s"} active in the archive today
            </Badge>
            <Button
              variant="secondary"
              className="bg-gradient-to-r from-amber-400 via-fuchsia-500 to-indigo-500 text-white"
              onClick={() => document.getElementById("previews")?.scrollIntoView({ behavior: "smooth" })}
            >
              View cinematic previews
            </Button>
          </div>
        </div>
        <div className="grid gap-4 pt-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-4 text-sm font-semibold text-white/80 shadow-[0_14px_45px_rgba(0,0,0,0.35)]"
            >
              <p className="text-[0.6rem] font-black uppercase tracking-[0.4em] text-white/60">{stat.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/55">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// -----------------------------------------------------------------------------
// Character presentation
// -----------------------------------------------------------------------------
const PreviewBoard = ({ data, onOpen }) => {
  const previews = useMemo(() => {
    if (!data.length) return [];
    const highlight = pickDaily(data, "preview");
    const remainder = data
      .filter((character) => !highlight || character.id !== highlight.id)
      .sort((a, b) => scoreCharacter(b) - scoreCharacter(a))
      .slice(0, 4);
    return highlight ? [highlight, ...remainder] : remainder;
  }, [data]);

  const palette = [
    "from-amber-400/35 via-fuchsia-500/20 to-indigo-500/20",
    "from-sky-500/25 via-cyan-400/20 to-emerald-400/20",
    "from-purple-500/25 via-indigo-500/20 to-slate-500/20",
    "from-rose-500/25 via-orange-400/20 to-yellow-300/20",
  ];

  if (!previews.length) return null;

  return (
    <section id="previews" className="mx-auto mt-12 max-w-7xl">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/65">Cinematic Previews</p>
          <h2 className="text-2xl font-black text-white sm:text-3xl">Tonight’s Dispatches from the Vault</h2>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
          Hover for atmosphere • Click to open dossiers
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {previews.map((character, index) => {
          const image = character.cover || character.gallery?.[0];
          const accent = palette[index % palette.length];
          return (
            <motion.button
              key={character.id}
              type="button"
              onClick={() => onOpen(character)}
              whileHover={{ scale: 1.03, y: -6 }}
              className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/15 bg-white/10 text-left text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
            >
              <div className={cx("absolute inset-0 bg-gradient-to-br", accent)} />
              {image ? (
                <div className="absolute inset-0 overflow-hidden">
                  <ImageSafe
                    src={image}
                    alt={character.name}
                    fallbackLabel={character.name}
                    className="h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Insignia label={character.name} size={70} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-between p-5">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.35em] text-white/70">
                    Preview {index + 1}
                  </span>
                  <h3 className="text-lg font-black drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]">{character.name}</h3>
                  <p className="text-xs font-semibold leading-relaxed text-white/80">
                    {character.shortDesc || character.longDesc || "Select to enter the full cinematic dossier."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{character.faction?.[0] || character.locations?.[0] || "Unaligned"}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

// -----------------------------------------------------------------------------
// Character presentation
// -----------------------------------------------------------------------------
const PowerMeter = ({ level }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
    <div
      className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200"
      style={{ width: `${Math.max(0, Math.min(10, level)) * 10}%` }}
    />
  </div>
);

const Insignia = ({ label, size = 44 }) => {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "LM";
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-white shadow-[0_12px_45px_rgba(0,0,0,0.4)]"
      style={{ width: size, height: size }}
    >
      <span className="text-sm font-black tracking-[0.3em]">{initials}</span>
    </div>
  );
};

const ImageSafe = ({ src, alt, className = "", fallbackLabel }) => {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className={cx("flex items-center justify-center bg-black/35", className)}>
        <Insignia label={fallbackLabel || alt || "Lore"} size={72} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={cx("object-cover", className)} loading="lazy" onError={() => setErr(true)} />;
};

const FacetChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      "rounded-full border px-3 py-1 text-xs font-bold transition",
      active ? "border-amber-300 bg-amber-200/20 text-amber-100" : "border-white/25 bg-white/10 text-white/80 hover:bg-white/20"
    )}
  >
    {children}
  </button>
);

const CharacterCard = ({ character, onOpen, onFacet, onUseInArena }) => {
  const [pulse, setPulse] = useState(false);
  const triggerSim = () => {
    setPulse(true);
    onUseInArena(character);
    setTimeout(() => setPulse(false), 420);
  };

  return (
    <Card
      className={cx(
        "overflow-hidden transition",
        pulse ? "ring-2 ring-amber-300" : "hover:-translate-y-2 hover:shadow-[0_28px_80px_rgba(0,0,0,0.45)]"
      )}
    >
      <div className="relative h-56 w-full">
        <button
          type="button"
          className="group absolute inset-0 overflow-hidden"
          onClick={() => onOpen(character)}
        >
          <ImageSafe
            src={character.cover || character.gallery[0]}
            alt={character.name}
            fallbackLabel={character.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-85 transition duration-500 group-hover:opacity-70" />
        </button>
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <Insignia label={character.faction?.[0] || character.name} size={38} />
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -6 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={triggerSim}
            className="hidden rounded-full bg-amber-300 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.35em] text-black shadow-lg md:flex"
          >
            <Swords className="mr-1 h-3.5 w-3.5" /> Simulate
          </motion.button>
        </div>
      </div>
      <CardHeader className="pb-4">
        <CardTitle className="text-white">
          <button type="button" className="text-left" onClick={() => onOpen(character)}>
            {character.name}
          </button>
        </CardTitle>
        <CardDescription>{character.shortDesc || character.longDesc || "No description available."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {character.gender ? <FacetChip onClick={() => onFacet({ key: "gender", value: character.gender })}>{character.gender}</FacetChip> : null}
          {character.alignment ? <FacetChip onClick={() => onFacet({ key: "alignment", value: character.alignment })}>{character.alignment}</FacetChip> : null}
          {(character.locations || []).slice(0, 2).map((location) => (
            <FacetChip key={location} onClick={() => onFacet({ key: "locations", value: location })}>
              {location}
            </FacetChip>
          ))}
          {(character.faction || []).slice(0, 1).map((faction) => (
            <FacetChip key={faction} onClick={() => onFacet({ key: "faction", value: faction })}>
              {faction}
            </FacetChip>
          ))}
        </div>
        {character.powers?.[0] ? (
          <div className="space-y-2 text-xs font-bold text-white/90">
            <div className="flex items-center justify-between">
              <span>{character.powers[0].name}</span>
              <span>{character.powers[0].level}/10</span>
            </div>
            <PowerMeter level={character.powers[0].level} />
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => onOpen(character)}>
          Read <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="md:hidden" onClick={() => onUseInArena(character)}>
          <Swords className="h-4 w-4" /> Sim
        </Button>
      </CardFooter>
    </Card>
  );
};

const Gallery = ({ cover, images, name }) => {
  const [index, setIndex] = useState(0);
  const sources = [cover, ...(images || [])].filter(Boolean);
  if (!sources.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Insignia label={name} size={72} />
      </div>
    );
  }
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10">
      <ImageSafe src={sources[index]} alt={`${name} gallery ${index + 1}`} fallbackLabel={name} className="h-full w-full" />
      {sources.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur"
            onClick={() => setIndex((prev) => (prev - 1 + sources.length) % sources.length)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur"
            onClick={() => setIndex((prev) => (prev + 1) % sources.length)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {sources.map((_, dot) => (
              <span key={String(dot)} className={cx("h-1.5 w-1.5 rounded-full", dot === index ? "bg-white" : "bg-white/60")} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

const CharacterModal = ({ open, character, onClose, onFacet, onUseInArena }) => {
  useEffect(() => {
    if (!open) return () => undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !character) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        className="relative max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/10 text-white shadow-[0_20px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <Insignia label={character.name} size={44} />
            <div>
              <h3 className="text-2xl font-black">{character.name}</h3>
              {character.era ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">{character.era}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onUseInArena(character)}>
              <Swords className="h-4 w-4" /> Use in Arena
            </Button>
            <IconButton icon={X} label="Close" onClick={onClose} className="border-white/30 bg-white/10" />
          </div>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
          <div className="space-y-4">
            <Gallery cover={character.cover} images={character.gallery} name={character.name} />
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Summary</p>
                <p className="mt-2 whitespace-pre-line text-white/85">{character.shortDesc || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Biography</p>
                <p className="mt-2 whitespace-pre-line text-white/85">{character.longDesc || "—"}</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              {(character.alias || []).map((alias) => (
                <FacetChip key={alias} onClick={() => onFacet({ key: "alias", value: alias })}>
                  {alias}
                </FacetChip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {character.gender ? (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Gender</p>
                  <p className="mt-1 font-bold text-white">{character.gender}</p>
                </div>
              ) : null}
              {character.alignment ? (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Alignment</p>
                  <p className="mt-1 font-bold text-white">{character.alignment}</p>
                </div>
              ) : null}
              {character.status ? (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Status</p>
                  <p className="mt-1 font-bold text-white">{character.status}</p>
                </div>
              ) : null}
              {character.firstAppearance ? (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">First Appearance</p>
                  <p className="mt-1 font-bold text-white">{character.firstAppearance}</p>
                </div>
              ) : null}
            </div>
            {character.locations?.length ? (
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  <MapPin className="h-3.5 w-3.5" /> Locations
                </p>
                <div className="flex flex-wrap gap-2">
                  {character.locations.map((location) => (
                    <FacetChip key={location} onClick={() => onFacet({ key: "locations", value: location })}>
                      {location}
                    </FacetChip>
                  ))}
                </div>
              </div>
            ) : null}
            {character.faction?.length ? (
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  <Sparkles className="h-3.5 w-3.5" /> Factions
                </p>
                <div className="flex flex-wrap gap-2">
                  {character.faction.map((faction) => (
                    <FacetChip key={faction} onClick={() => onFacet({ key: "faction", value: faction })}>
                      {faction}
                    </FacetChip>
                  ))}
                </div>
              </div>
            ) : null}
            {character.tags?.length ? (
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  <Layers className="h-3.5 w-3.5" /> Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {character.tags.map((tag) => (
                    <FacetChip key={tag} onClick={() => onFacet({ key: "tags", value: tag })}>
                      {tag}
                    </FacetChip>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                <Atom className="h-3.5 w-3.5" /> Powers
              </p>
              <div className="space-y-2">
                {(character.powers || []).map((power) => (
                  <div key={power.name} className="space-y-1 text-xs text-white/80">
                    <div className="flex items-center justify-between font-bold">
                      <span>{power.name}</span>
                      <span>{power.level}/10</span>
                    </div>
                    <PowerMeter level={power.level} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Hero slider
// -----------------------------------------------------------------------------
const FeaturedCard = ({ label, title, description, actions, image, accent = "from-indigo-600/35 via-fuchsia-500/25 to-amber-400/20" }) => (
  <motion.article
    className="relative grid h-72 grid-cols-1 overflow-hidden rounded-3xl border border-white/15 bg-black/40 text-white shadow-[0_20px_80px_rgba(0,0,0,0.55)] md:grid-cols-[3fr_2fr]"
    whileHover={{ y: -6, boxShadow: "0 28px 90px rgba(0,0,0,0.55)" }}
    transition={{ type: "spring", stiffness: 140, damping: 18 }}
  >
    <div className={cx("absolute inset-0 bg-gradient-to-br", accent)} />
    {image ? (
      <div className="absolute inset-0 opacity-60">
        <ImageSafe
          src={image}
          alt={title}
          fallbackLabel={title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/20 to-transparent" />
      </div>
    ) : null}
    <div className="relative z-10 grid h-full grid-cols-1 md:grid-cols-[3fr_2fr]">
      <div className="flex flex-col justify-between p-6">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
            <Clock className="h-3.5 w-3.5" /> {label}
          </p>
          <h3 className="text-2xl font-black drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]">{title}</h3>
          <p className="text-sm font-semibold text-white/85">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant || "secondary"}
              onClick={action.onClick}
              className={cx(
                action.highlight ? "bg-gradient-to-r from-amber-400 via-fuchsia-500 to-indigo-500 text-white" : "",
                action.className
              )}
            >
              {action.label}
              {action.icon ? <action.icon className="h-4 w-4" /> : null}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative hidden overflow-hidden md:flex">
        {image ? (
          <>
            <ImageSafe
              src={image}
              alt={`${title} artwork`}
              fallbackLabel={title}
              className="h-full w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/35 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/10">
            <Sparkles className="h-16 w-16 text-white/70" />
          </div>
        )}
      </div>
    </div>
  </motion.article>
);

const accentForAlignment = (alignment = "") => {
  const tone = alignment.toLowerCase();
  if (tone.includes("hero")) return "from-emerald-400/35 via-cyan-400/25 to-sky-500/20";
  if (tone.includes("villain") || tone.includes("rogue") || tone.includes("dark"))
    return "from-rose-500/40 via-purple-500/25 to-indigo-500/25";
  if (tone.includes("neutral")) return "from-amber-400/30 via-emerald-400/20 to-sky-400/20";
  return "from-indigo-600/35 via-fuchsia-500/25 to-amber-400/20";
};

const HeroSlider = ({ data, onOpen, onFacet }) => {
  const character = useMemo(() => pickDaily(data, "character"), [data]);
  const factions = useMemo(() => Array.from(new Set(data.flatMap((char) => char.faction || []))), [data]);
  const locations = useMemo(() => Array.from(new Set(data.flatMap((char) => char.locations || []))), [data]);
  const powers = useMemo(() => Array.from(new Set(data.flatMap((char) => char.powers.map((power) => power.name)))), [data]);

  const slides = useMemo(() => {
    const deck = [];
    if (character) {
      const image = character.cover || character.gallery?.[0];
      deck.push({
        type: "Character",
        render: () => (
          <FeaturedCard
            label="Featured Character"
            title={character.name}
            description={character.shortDesc || character.longDesc || "No summary available."}
            image={image}
            accent={accentForAlignment(character.alignment || "")}
            actions={[
              { label: "Character Profile", onClick: () => onOpen(character), icon: ArrowRight, highlight: true },
              character.faction?.[0]
                ? { label: character.faction[0], onClick: () => onFacet({ key: "faction", value: character.faction[0] }) }
                : null,
              character.gender
                ? { label: `Gender: ${character.gender}`, onClick: () => onFacet({ key: "gender", value: character.gender }) }
                : null,
              character.powers?.[0]
                ? { label: `Power: ${character.powers[0].name}`, onClick: () => onFacet({ key: "powers", value: character.powers[0].name }) }
                : null,
            ].filter(Boolean)}
          />
        ),
      });
    }
    if (factions.length) {
      const faction = pickDaily(factions, "faction");
      if (faction) {
        const factionCharacter = data.find((char) => (char.faction || []).includes(faction));
        const factionImage = factionCharacter?.cover || factionCharacter?.gallery?.[0];
        deck.push({
          type: "Faction",
          render: () => (
            <FeaturedCard
              label="Featured Faction"
              title={faction}
              description="Explore every member aligned under this banner."
              image={factionImage}
              accent="from-amber-400/30 via-fuchsia-500/25 to-rose-500/25"
              actions={[
                { label: "View Members", onClick: () => onFacet({ key: "faction", value: faction }), highlight: true },
                { label: "Filter by Faction", onClick: () => onFacet({ key: "faction", value: faction }) },
              ]}
            />
          ),
        });
      }
    }
    if (locations.length) {
      const location = pickDaily(locations, "location");
      if (location) {
        const locationCharacter = data.find((char) =>
          (char.locations || []).some((loc) => loc.toLowerCase() === location.toLowerCase())
        );
        const locationImage = locationCharacter?.cover || locationCharacter?.gallery?.[0];
        deck.push({
          type: "Location",
          render: () => (
            <FeaturedCard
              label="Featured Location"
              title={location}
              description="Travel to this realm and see who thrives—or schemes—within."
              image={locationImage}
              accent="from-sky-500/30 via-cyan-400/20 to-emerald-400/20"
              actions={[
                { label: "View Residents", onClick: () => onFacet({ key: "locations", value: location }), highlight: true },
              ]}
            />
          ),
        });
      }
    }
    if (powers.length) {
      const power = pickDaily(powers, "power");
      if (power) {
        const powerCharacter = data.find((char) =>
          (char.powers || []).some((entry) => entry.name.toLowerCase() === power.toLowerCase())
        );
        const powerImage = powerCharacter?.cover || powerCharacter?.gallery?.[0];
        deck.push({
          type: "Power",
          render: () => (
            <FeaturedCard
              label="Featured Power"
              title={power}
              description="Compare how each wielder bends this ability to their will."
              image={powerImage}
              accent="from-purple-500/30 via-indigo-500/20 to-cyan-400/20"
              actions={[
                { label: "View Wielders", onClick: () => onFacet({ key: "powers", value: power }), highlight: true },
              ]}
            />
          ),
        });
      }
    }
    return deck;
  }, [character, factions, locations, powers, onFacet, onOpen, data]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowLeft") setIndex((prev) => (prev - 1 + slides.length) % slides.length);
      if (event.key === "ArrowRight") setIndex((prev) => (prev + 1) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <section className="mx-auto max-w-5xl space-y-3 text-white">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/65">Today’s Featured</p>
        <span className="text-xs font-semibold text-white/60">{todayKey()} • {slides[index].type}</span>
      </div>
      <div className="relative">
        {slides[index].render()}
        <button
          type="button"
          aria-label="Previous"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur"
          onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur"
          onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
};

// -----------------------------------------------------------------------------
// Sorting & filtering
// -----------------------------------------------------------------------------
const SORTS = [
  { key: "default", label: "Default" },
  { key: "random", label: "Random" },
  { key: "faction", label: "By Faction" },
  { key: "az", label: "A-Z" },
  { key: "za", label: "Z-A" },
  { key: "strongest", label: "From Most Powerful" },
  { key: "weakest", label: "From Least Powerful" },
];

const applySort = (characters, mode) => {
  switch (mode) {
    case "random": {
      const rand = seededRandom(`${todayKey()}|grid`);
      return [...characters].sort(() => rand() - 0.5);
    }
    case "faction":
      return [...characters].sort((a, b) => (a.faction?.[0] || "").localeCompare(b.faction?.[0] || ""));
    case "az":
      return [...characters].sort((a, b) => a.name.localeCompare(b.name));
    case "za":
      return [...characters].sort((a, b) => b.name.localeCompare(a.name));
    case "strongest":
      return [...characters].sort((a, b) => scoreCharacter(b) - scoreCharacter(a));
    case "weakest":
      return [...characters].sort((a, b) => scoreCharacter(a) - scoreCharacter(b));
    default:
      return characters;
  }
};

const matchesFilters = (character, filters, mode, query) => {
  const haystack = [
    character.name,
    ...(character.alias || []),
    ...(character.faction || []),
    ...(character.locations || []),
    ...(character.tags || []),
    ...(character.powers || []).map((power) => power.name),
    character.shortDesc,
    character.longDesc,
  ]
    .join(" ")
    .toLowerCase();

  const terms = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.every((term) => haystack.includes(term))) return false;

  const checks = [];
  if (filters.gender) checks.push((character.gender || "").toLowerCase() === filters.gender.toLowerCase());
  if (filters.alignment) checks.push((character.alignment || "").toLowerCase() === filters.alignment.toLowerCase());
  if (filters.locations?.length)
    checks.push(filters.locations.every((loc) => character.locations.map((l) => l.toLowerCase()).includes(loc.toLowerCase())));
  if (filters.faction?.length)
    checks.push(filters.faction.every((f) => (character.faction || []).map((value) => value.toLowerCase()).includes(f.toLowerCase())));
  if (filters.tags?.length)
    checks.push(filters.tags.every((tag) => (character.tags || []).map((value) => value.toLowerCase()).includes(tag.toLowerCase())));
  if (filters.status?.length)
    checks.push(filters.status.some((status) => (character.status || "").toLowerCase() === status.toLowerCase()));
  if (filters.era?.length) checks.push(filters.era.some((era) => (character.era || "").toLowerCase() === era.toLowerCase()));
  if (filters.powers?.length)
    checks.push(filters.powers.every((power) => character.powers.map((p) => p.name.toLowerCase()).includes(power.toLowerCase())));
  if (filters.alias?.length)
    checks.push(filters.alias.some((alias) => (character.alias || []).map((a) => a.toLowerCase()).includes(alias.toLowerCase())));
  if (filters.stories?.length)
    checks.push(filters.stories.every((story) => (character.stories || []).map((s) => s.toLowerCase()).includes(story.toLowerCase())));

  if (!checks.length) return true;
  return mode === "and" ? checks.every(Boolean) : checks.some(Boolean);
};

const SidebarFilters = ({ open, onClose, filters, setFilters, mode, setMode, data, onClear }) => {
  const unique = (picker) => Array.from(new Set(data.flatMap(picker))).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const toggleSet = (key, value) =>
    setFilters((prev) => {
      const set = new Set(prev[key] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });

  const toggleSingle = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));

  const Section = ({ title, values, keyName, single }) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <FacetChip
            key={value}
            active={single ? filters[keyName] === value : (filters[keyName] || []).includes(value)}
            onClick={() => (single ? toggleSingle(keyName, value) : toggleSet(keyName, value))}
          >
            {value}
          </FacetChip>
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ x: 340 }}
          animate={{ x: 0 }}
          exit={{ x: 340 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed right-0 top-0 z-50 h-full w-[340px] overflow-y-auto border-l border-white/15 bg-black/85 p-6 text-white backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white/70">Filters</h3>
            <IconButton icon={X} label="Close filters" onClick={onClose} className="border-white/30 bg-white/10" />
          </div>
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-3">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Mode</span>
              <button
                type="button"
                className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-[0.35em] text-black shadow"
                onClick={() => setMode((prev) => (prev === "and" ? "or" : "and"))}
              >
                {mode === "and" ? "AND" : "ANY"}
              </button>
            </div>
            <Button variant="destructive" className="w-full" onClick={onClear}>
              Clear Filters
            </Button>
            <Section title="Gender" values={unique((character) => [character.gender])} keyName="gender" single />
            <Section title="Alignment" values={unique((character) => [character.alignment])} keyName="alignment" single />
            <Section title="Era" values={unique((character) => [character.era])} keyName="era" />
            <Section title="Status" values={unique((character) => [character.status])} keyName="status" />
            <Section title="Locations" values={unique((character) => character.locations || [])} keyName="locations" />
            <Section title="Factions" values={unique((character) => character.faction || [])} keyName="faction" />
            <Section title="Powers" values={unique((character) => (character.powers || []).map((power) => power.name))} keyName="powers" />
            <Section title="Tags" values={unique((character) => character.tags || [])} keyName="tags" />
            <Section title="Stories" values={unique((character) => character.stories || [])} keyName="stories" />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
};

// -----------------------------------------------------------------------------
// Character grid helpers
// -----------------------------------------------------------------------------
const StoryChips = ({ data, onFacet }) => {
  const stories = useMemo(() => {
    const tally = new Map();
    data.forEach((character) => {
      (character.stories || []).forEach((story) => tally.set(story, (tally.get(story) || 0) + 1));
    });
    return Array.from(tally.entries())
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
};

const CharacterGrid = ({ data, onOpen, onFacet, onUseInArena }) => (
  <div className="grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
    {data.map((character) => (
      <CharacterCard
        key={character.id}
        character={character}
        onOpen={onOpen}
        onFacet={onFacet}
        onUseInArena={onUseInArena}
      />
    ))}
    {!data.length ? (
      <div className="text-white/80">No characters match your filters yet.</div>
    ) : null}
  </div>
);

// -----------------------------------------------------------------------------
// Battle arena
// -----------------------------------------------------------------------------
const HEALTH_BAR_VARIANTS = {
  hidden: { scaleX: 0, opacity: 0 },
  ready: { scaleX: 1, opacity: 1 },
};

const ArenaSlot = ({ label, character, onRelease, onRandom, isChampion }) => (
  <div
    className={cx(
      "relative flex min-h-[18rem] flex-col gap-4 rounded-3xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-[0_16px_60px_rgba(15,23,42,0.25)]",
      isChampion ? "ring-4 ring-amber-300" : ""
    )}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onRandom} className="border-slate-300 text-slate-700">
          Randomise
        </Button>
        {character ? (
          <IconButton icon={X} label="Release" onClick={onRelease} className="border-slate-200 bg-slate-100 text-slate-600" />
        ) : null}
      </div>
    </div>
    {character ? (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-18 w-18 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
            <ImageSafe src={character.cover || character.gallery[0]} alt={character.name} fallbackLabel={character.name} className="h-full w-full" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">{character.name}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{character.faction?.[0] || "Unaligned"}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Health Bar</p>
          <motion.div className="mt-2 h-2 rounded-full bg-slate-200" initial="hidden" animate="ready" variants={HEALTH_BAR_VARIANTS}>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400"
              animate={{ scaleX: isChampion ? 1 : 0.4 }}
              transition={{ duration: 1.3, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
            />
          </motion.div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Alignment</p>
            <p className="mt-1 font-bold text-slate-800">{character.alignment || "Unknown"}</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Status</p>
            <p className="mt-1 font-bold text-slate-800">{character.status || "Unknown"}</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Era</p>
            <p className="mt-1 font-bold text-slate-800">{character.era || "Unknown"}</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Locations</p>
            <p className="mt-1 font-bold text-slate-800">{character.locations?.join(", ") || "—"}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Powers</p>
          <div className="mt-2 space-y-2">
            {(character.powers || []).map((power) => (
              <div key={power.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{power.name}</span>
                  <span>{power.level}/10</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-500 via-amber-400 to-rose-400"
                    style={{ width: `${Math.max(0, Math.min(10, power.level)) * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-slate-500">
        <Swords className="h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold">Select or randomise a character to enter the arena.</p>
      </div>
    )}
  </div>
);

const BattleArena = ({
  characters,
  slotA,
  slotB,
  onRandomise,
  onRelease,
  onFight,
  onClose,
  result,
  fighting,
}) => {
  const charA = slotA ? characters.find((character) => character.id === slotA) : null;
  const charB = slotB ? characters.find((character) => character.id === slotB) : null;
  const championId = result?.winner?.id;

  return (
    <Card className="bg-white text-slate-900 shadow-[0_20px_80px_rgba(15,23,42,0.35)]">
      <CardHeader className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-900">Battle Arena</CardTitle>
            <CardDescription className="text-slate-600">Characters become Champions through calculated strikes and luck swings.</CardDescription>
          </div>
          <IconButton icon={X} label="Hide arena" onClick={onClose} className="border-slate-200 bg-slate-100 text-slate-600" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <ArenaSlot
            label="Character One"
            character={charA}
            onRelease={() => onRelease("a")}
            onRandom={() => onRandomise("a")}
            isChampion={championId && charA && championId === charA.id}
          />
          <ArenaSlot
            label="Character Two"
            character={charB}
            onRelease={() => onRelease("b")}
            onRandom={() => onRandomise("b")}
            isChampion={championId && charB && championId === charB.id}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700"
            onClick={() => onRandomise(!slotA ? "a" : !slotB ? "b" : "a")}
          >
            Randomise Next Slot
          </Button>
          <Button
            variant="secondary"
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={onFight}
            disabled={!charA || !charB || charA.id === charB.id || fighting}
          >
            Fight
          </Button>
          <Button variant="outline" className="border-slate-300 text-slate-700" onClick={() => { onRelease("a"); onRelease("b"); }}>
            Reset
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            <Swords className={cx("h-4 w-4", fighting ? "animate-pulse text-amber-500" : "text-slate-500")} />
            {fighting ? "Calculating" : result ? "Champion crowned" : "Awaiting contestants"}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <motion.div
            animate={fighting ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
            transition={fighting ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
            className={cx(
              "relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-900 text-white",
              fighting ? "shadow-[0_0_40px_rgba(251,191,36,0.7)]" : ""
            )}
          >
            <Swords className="h-8 w-8" />
            <motion.span
              className="absolute inset-0 rounded-full"
              initial={{ opacity: 0 }}
              animate={fighting ? { opacity: [0.2, 0.6, 0.2] } : { opacity: 0 }}
              transition={{ duration: 0.9, repeat: fighting ? Infinity : 0, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)" }}
            />
          </motion.div>
        </div>
        {result ? (
          <div className="grid gap-4 text-sm text-slate-700 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{charA?.name || "—"}</p>
              <p className="mt-2 font-bold">Base Score: {result.scores.a.base}</p>
              <p className="font-bold">Luck Swings: {result.scores.a.luck}</p>
              <p className="font-bold">Final: {result.scores.a.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-center text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Champion</p>
              <p className="mt-2 text-lg font-black">{result.winner.name}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{charB?.name || "—"}</p>
              <p className="mt-2 font-bold">Base Score: {result.scores.b.base}</p>
              <p className="font-bold">Luck Swings: {result.scores.b.luck}</p>
              <p className="font-bold">Final: {result.scores.b.total}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Sort rail, quick controls & floating helpers
// -----------------------------------------------------------------------------
const SortRail = ({ active, onSelect }) => (
  <div className="flex flex-wrap gap-2">
    {SORTS.map((option) => (
      <button
        key={option.key}
        type="button"
        onClick={() => onSelect(option.key)}
        className={cx(
          "rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.2em] transition",
          active === option.key
            ? "border-amber-300 bg-amber-300/20 text-amber-100"
            : "border-white/25 bg-white/10 text-white/75 hover:bg-white/20"
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const QuickControls = ({
  query,
  setQuery,
  onOpenFilters,
  onClear,
  onToggleArena,
  arenaVisible,
  sortedBy,
  onSort,
}) => (
  <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-6 text-white shadow-[0_16px_70px_rgba(0,0,0,0.45)] backdrop-blur-lg">
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search characters, powers, factions, locations..."
          className="pl-9"
        />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" className="bg-gradient-to-r from-amber-500 via-fuchsia-500 to-indigo-500 text-white" onClick={onOpenFilters}>
          <Filter className="h-4 w-4" /> Filters
        </Button>
        <Button variant="outline" onClick={onClear}>
          Clear
        </Button>
        <Button variant={arenaVisible ? "secondary" : "outline"} onClick={onToggleArena}>
          Arena {arenaVisible ? "On" : "Off"}
        </Button>
      </div>
    </div>
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Sort Characters</p>
      <SortRail active={sortedBy} onSelect={onSort} />
    </div>
  </div>
);

const ScrollControls = () => {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      setShowTop(scrollTop > 180);
      setShowBottom(scrollTop + clientHeight < scrollHeight - 300);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {showBottom ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
            className="rounded-full border border-white/25 bg-white/10 p-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur hover:bg-white/20"
          >
            <ArrowDown className="h-5 w-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showTop ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="rounded-full border border-white/25 bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-indigo-500 p-3 text-white shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Chat dock & telemetry
// -----------------------------------------------------------------------------
const useVisitTelemetry = (enabled) => {
  useEffect(() => {
    if (!enabled || !TRACK_VISIT_WEBHOOK) return;
    const controller = new AbortController();
    fetch(TRACK_VISIT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "loremaker", at: new Date().toISOString() }),
      signal: controller.signal,
    }).catch((error) => console.warn("Telemetry failed", error));
    return () => controller.abort();
  }, [enabled]);
};

const ChatDock = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text }]);
    setInput("");
    try {
      if (CHATBOT_WEBHOOK) {
        await fetch(CHATBOT_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, page: "loremaker" }),
        });
      }
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "bot", text: "Message received. A Lorekeeper will respond soon." }]);
    } catch (error) {
      console.warn("Chat webhook failed", error);
      setMessages((prev) => [...prev, { id: Date.now() + 2, role: "bot", text: "We could not reach the Lorekeeper right now." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-40">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mb-3 w-72 rounded-3xl border border-white/10 bg-white/10 p-4 text-white shadow-[0_14px_45px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" /> Lore Chat
              </div>
              <IconButton icon={X} label="Close chat" onClick={() => setOpen(false)} className="border-white/20 bg-white/10" />
            </div>
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cx(
                    "rounded-2xl px-3 py-2",
                    message.role === "user" ? "bg-amber-300/30 text-amber-100" : "bg-white/15 text-white"
                  )}
                >
                  {message.text}
                </div>
              ))}
              {!messages.length ? (
                <p className="rounded-2xl bg-white/5 p-3 text-white/70">
                  Ask the Lorekeeper about characters, factions, or events and we’ll route it through the connected workflow.
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask the Lorekeeper..."
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-400 text-black shadow disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur hover:bg-white/20"
      >
        <MessageCircle className="h-4 w-4" /> Chat
      </button>
    </div>
  );
};

const Footer = () => (
  <footer className="mt-16 border-t border-white/10 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-white/70 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold">© {new Date().getFullYear()} Loremaker • ICUNI</p>
        <p className="text-xs">Mythic universes engineered by Menelek Makonnen.</p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-white">
        <a href={LINKS.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/20">
          <Instagram className="h-4 w-4" /> Instagram
        </a>
        <a href={LINKS.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/20">
          <Youtube className="h-4 w-4" /> YouTube
        </a>
        <a href={LINKS.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/20">
          <Linkedin className="h-4 w-4" /> LinkedIn
        </a>
        <a href={LINKS.email} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 hover:bg-white/20">
          <Mail className="h-4 w-4" /> Email
        </a>
      </div>
    </div>
  </footer>
);

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------
const computeFightResult = (charA, charB) => {
  const baseA = scoreCharacter(charA);
  const baseB = scoreCharacter(charB);
  const swing = Math.max(baseA, baseB, 10) * 0.18;
  let luckA = 0;
  let luckB = 0;
  for (let i = 0; i < 3; i += 1) {
    luckA += rngLuck(`${charA.id}|${charB.id}|${i}|A|${todayKey()}`, swing);
    luckB += rngLuck(`${charB.id}|${charA.id}|${i}|B|${todayKey()}`, swing);
  }
  const totalA = baseA + luckA;
  const totalB = baseB + luckB;
  const winner = totalA === totalB ? (Math.random() > 0.5 ? charA : charB) : totalA > totalB ? charA : charB;
  return {
    winner,
    scores: {
      a: { base: baseA, luck: luckA, total: totalA },
      b: { base: baseB, luck: luckB, total: totalB },
    },
  };
};

export default function LoremakerPage() {
  const { data, loading, error, refetch } = useCharacters();
  const [filters, setFilters] = useState({});
  const [filterMode, setFilterMode] = useState("and");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [current, setCurrent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [slotA, setSlotA] = useState("");
  const [slotB, setSlotB] = useState("");
  const [arenaVisible, setArenaVisible] = useState(false);
  const [fightResult, setFightResult] = useState(null);
  const [fighting, setFighting] = useState(false);

  useVisitTelemetry(true);

  const filtered = useMemo(() => {
    const matches = data.filter((character) => matchesFilters(character, filters, filterMode, query));
    return applySort(matches, sort);
  }, [data, filters, filterMode, query, sort]);

  const gridCharacters = useMemo(() => filtered.filter((character) => character.id !== slotA && character.id !== slotB), [filtered, slotA, slotB]);

  const openModal = (character) => {
    setCurrent(character);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleFacet = (facet) => {
    setFilters((prev) => {
      const next = { ...prev };
      const key = facet.key;
      if (["locations", "faction", "tags", "powers", "stories", "alias", "status", "era"].includes(key)) {
        const set = new Set(prev[key] || []);
        set.add(facet.value);
        next[key] = Array.from(set);
      } else {
        next[key] = facet.value;
      }
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => setFilters({});

  const handleUseInArena = (character) => {
    setArenaVisible(true);
    setFightResult(null);
    if (!slotA || slotA === character.id) {
      setSlotA(character.id);
      return;
    }
    if (!slotB || slotB === character.id) {
      setSlotB(character.id);
      return;
    }
    setSlotA(character.id);
    setSlotB("");
  };

  const releaseSlot = (slot) => {
    if (slot === "a") setSlotA("");
    if (slot === "b") setSlotB("");
    setFightResult(null);
  };

  const randomiseSlot = (slot) => {
    if (!filtered.length) return;
    const available = filtered.filter((character) => character.id !== (slot === "a" ? slotB : slotA));
    if (!available.length) return;
    const rand = seededRandom(`${todayKey()}|${slot}|randomise`);
    const pick = available[Math.floor(rand() * available.length)] || available[0];
    if (slot === "a") setSlotA(pick.id);
    else setSlotB(pick.id);
    setFightResult(null);
  };

  const runFight = () => {
    if (!slotA || !slotB || slotA === slotB) return;
    const charA = data.find((character) => character.id === slotA);
    const charB = data.find((character) => character.id === slotB);
    if (!charA || !charB) return;
    setFighting(true);
    setTimeout(() => {
      setFightResult(computeFightResult(charA, charB));
      setFighting(false);
    }, 1300);
  };

  useEffect(() => {
    if (!slotA && !slotB) setFightResult(null);
  }, [slotA, slotB]);

  const heroCount = data.length;
  const showStories = data.some((character) => (character.stories || []).length);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080915] text-white">
      <CosmicBackdrop />
      <NavBar onRefresh={refetch} refreshing={loading} />
      <main className="mx-auto max-w-7xl px-4 pb-32">
        <Hero total={heroCount} />
        <PreviewBoard data={filtered} onOpen={openModal} />
        <div className="mt-10 space-y-12">
          <QuickControls
            query={query}
            setQuery={setQuery}
            onOpenFilters={() => setShowFilters(true)}
            onClear={clearFilters}
            onToggleArena={() => setArenaVisible((prev) => !prev)}
            arenaVisible={arenaVisible}
            sortedBy={sort}
            onSort={setSort}
          />
          <HeroSlider data={filtered} onOpen={openModal} onFacet={handleFacet} />
          {showStories ? (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Stories</p>
              <StoryChips data={filtered} onFacet={handleFacet} />
            </section>
          ) : null}
          {loading ? <p className="text-white/80">Loading characters from Google Sheets…</p> : null}
          {error ? <p className="text-red-300">{error}</p> : null}
          <CharacterGrid data={gridCharacters} onOpen={openModal} onFacet={handleFacet} onUseInArena={handleUseInArena} />
        </div>
        <AnimatePresence>{arenaVisible ? (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="mt-12">
            <BattleArena
              characters={data}
              slotA={slotA}
              slotB={slotB}
              onRandomise={randomiseSlot}
              onRelease={releaseSlot}
              onFight={runFight}
              onClose={() => setArenaVisible(false)}
              result={fightResult}
              fighting={fighting}
            />
          </motion.div>
        ) : null}</AnimatePresence>
      </main>
      <SidebarFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        mode={filterMode}
        setMode={setFilterMode}
        data={data}
        onClear={clearFilters}
      />
      <CharacterModal open={modalOpen} character={current} onClose={closeModal} onFacet={handleFacet} onUseInArena={handleUseInArena} />
      <ScrollControls />
      <ChatDock />
      <Footer />
    </div>
  );
}
