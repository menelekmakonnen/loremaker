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

const CACHE_TTL = Number(process.env.LOREMAKER_SHEETS_CACHE_TTL || 600000);
const FALLBACK_SHEET_NAMES = ["Sheet1", "Characters"];
const CONFIG_ERROR_CODE = "MISSING_SHEET_ID";
const PUBLIC_AVAILABILITY_MESSAGE = "Character data is temporarily unavailable. Please try again soon.";

let cache = { data: null, timestamp: 0 };
const sourceOrder = new Map();

const toSlug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

export function normalizeDriveUrl(url) {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("drive.google.com")) {
      // Handle /file/d/FILE_ID/... format
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = (match && match[1]) || u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;

      // If it's already in the correct format, return as is
      if (u.pathname === "/uc" && u.searchParams.get("id")) {
        return trimmed;
      }
    }
    return trimmed;
  } catch {
    // If URL parsing fails, the string is not a valid URL
    return undefined;
  }
}

export function splitList(raw) {
  if (!raw) return [];
  return raw
    .replace(/\band\b/gi, ",")
    .replace(/[|;/]/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseLocations(raw) {
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

export function parsePowers(raw) {
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
    const stringValue = typeof value === "string" ? value : String(value ?? "");
    return stringValue.trim();
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
    if (url) {
      const normalized = normalizeDriveUrl(url);
      if (normalized) char.gallery.push(normalized);
    }
  }
  return char;
}

export const todayKey = () => new Date().toISOString().slice(0, 10);

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

export function fillDailyPowers(c) {
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

export function normaliseArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [value];
}

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export function computeFeatured(characters) {
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
    faction: faction ? { name: faction, members: factionMembers.slice(0, 8) } : null,
    location: location ? { name: location, residents: locationResidents.slice(0, 8) } : null,
    power: power ? { name: power, wielders: powerWielders.slice(0, 8) } : null,
  };
}

function parseCharactersResponse(response) {
  sourceOrder.clear();
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
      if (!sourceOrder.has(char.id)) sourceOrder.set(char.id, index);
    }
  });
  return parsed;
}

function gvizUrl(sheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

export async function fetchCharactersFromSheets({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }
  const sheetId = process.env.LOREMAKER_SHEET_ID || process.env.NEXT_PUBLIC_LOREMAKER_SHEET_ID;
  if (!sheetId) {
    const error = new Error("Google Sheets configuration missing");
    error.code = CONFIG_ERROR_CODE;
    error.publicMessage = PUBLIC_AVAILABILITY_MESSAGE;
    throw error;
  }
  if (!process.env.LOREMAKER_SHEET_ID && process.env.NEXT_PUBLIC_LOREMAKER_SHEET_ID) {
    console.warn(
      "[characters] Using NEXT_PUBLIC_LOREMAKER_SHEET_ID; please migrate to a server-side LOREMAKER_SHEET_ID environment variable."
    );
  }
  const sheetNames = Array.from(
    new Set([process.env.LOREMAKER_SHEET_TAB || "Characters", ...FALLBACK_SHEET_NAMES])
  );

  let lastError;
  for (const name of sheetNames) {
    try {
      const res = await fetch(gvizUrl(sheetId, name));
      if (!res.ok) throw new Error(`Google Sheets request failed (${res.status})`);
      const payload = parseGViz(await res.text());
      const data = parseCharactersResponse(payload);
      cache = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error("Unable to load characters from Google Sheets");
  error.cause = lastError;
  error.publicMessage = PUBLIC_AVAILABILITY_MESSAGE;
  throw error;
}

export function getCachedCharacters() {
  return cache.data;
}

export function getSourceOrder() {
  return sourceOrder;
}

export function clearCharacterCache() {
  cache = { data: null, timestamp: 0 };
  sourceOrder.clear();
}

export function isCharactersConfigError(error) {
  return Boolean(error && error.code === CONFIG_ERROR_CODE);
}

export function publicCharactersError(error) {
  if (error && typeof error === "object" && error.publicMessage) {
    return error.publicMessage;
  }
  if (!error) {
    return "Unable to load characters. Please try again.";
  }
  if (typeof error === "string") {
    if (/LOREMAKER_SHEET_ID/i.test(error)) {
      return PUBLIC_AVAILABILITY_MESSAGE;
    }
    return error;
  }
  if (isCharactersConfigError(error)) {
    return PUBLIC_AVAILABILITY_MESSAGE;
  }
  const message = error.message || "";
  if (!message) {
    return "Unable to load characters. Please try again.";
  }
  if (/LOREMAKER_SHEET_ID/i.test(message)) {
    return PUBLIC_AVAILABILITY_MESSAGE;
  }
  return message;
}
