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
const DEFAULT_SHEET_ID = "1nbAsU-zNe4HbM0bBLlYofi1pHhneEjEIWfW22JODBeM";
const CONFIG_ERROR_CODE = "MISSING_SHEET_ID";
const PUBLIC_AVAILABILITY_MESSAGE = "Character data is temporarily unavailable. Please try again soon.";

let cache = { data: null, timestamp: 0 };
const sourceOrder = new Map();

export const toSlug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

export const characterSlug = (character) => {
  if (!character) return "";
  return toSlug(character.slug || character.id || character.name || "");
};

export function normalizeDriveUrl(url) {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const u = new URL(trimmed);
    const ensureViewUrl = (id, sourceParams) => {
      if (!id) return undefined;
      const viewUrl = new URL("https://drive.google.com/uc");
      viewUrl.searchParams.set("export", "view");
      viewUrl.searchParams.set("id", id);
      const resourceKey = sourceParams?.get("resourcekey");
      if (resourceKey) {
        viewUrl.searchParams.set("resourcekey", resourceKey);
      }
      return viewUrl.toString();
    };

    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      const searchId = u.searchParams.get("id");
      if (u.pathname === "/thumbnail" && searchId) return ensureViewUrl(searchId, u.searchParams);
      if (match?.[1]) return ensureViewUrl(match[1], u.searchParams);
      if (u.pathname === "/open" && searchId) return ensureViewUrl(searchId, u.searchParams);
      if (u.pathname === "/uc" && searchId) {
        if (!u.searchParams.get("export")) {
          u.searchParams.set("export", "view");
        } else if (u.searchParams.get("export") === "download") {
          u.searchParams.set("export", "view");
        }
        return u.toString();
      }
      if (searchId) return ensureViewUrl(searchId, u.searchParams);
    }

    if (u.hostname.includes("drive.usercontent.google.com")) {
      return ensureViewUrl(u.searchParams.get("id"), u.searchParams);
    }

    if (u.hostname.includes("drive.googleusercontent.com")) {
      if (u.pathname === "/uc" && u.searchParams.get("id") && !u.searchParams.get("export")) {
        u.searchParams.set("export", "view");
        return u.toString();
      }
      return trimmed;
    }

    return trimmed;
  } catch {
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
  const fallbackId = toSlug(read("id") || name || "character");
  if (!char.id) {
    char.id = fallbackId;
  }
  char.slug = toSlug(char.slug || char.id || name);
  Object.keys(char).forEach((key) => {
    if (char[key] === undefined) {
      char[key] = null;
    }
  });
  return char;
}

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function seededRandom(seed) {
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
  const slug = toSlug(c.slug || c.id || c.name || "");
  const id = c.id || slug || toSlug(seed) || seed;
  const powers = (c.powers || []).map((p, idx) => {
    const label = p.name || `Power ${idx + 1}`;
    const base = Math.max(0, Math.min(10, Number(p.level) || 0));
    const min = base ? Math.max(3, base - 2) : 3;
    const max = base ? Math.min(10, base + 2) : 9;
    const level = dailyInt(`${seed}|${label}`, min, max);
    return { ...p, level };
  });
  const gallery = normaliseArray(c.gallery)
    .map((item) => normalizeDriveUrl(item) || item)
    .filter(Boolean);
  const cover = normalizeDriveUrl(c.cover) || c.cover || null;
  return {
    ...c,
    id,
    slug,
    alias: normaliseArray(c.alias),
    locations: normaliseArray(c.locations),
    faction: normaliseArray(c.faction),
    tags: normaliseArray(c.tags),
    stories: normaliseArray(c.stories),
    gallery,
    cover,
    powers,
  };
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

export function computeFeatured(characters) {
  if (!characters || !characters.length) {
    return { character: null, faction: null, location: null, power: null, backgrounds: [] };
  }
  const rng = seededRandom(`featured|${todayKey()}`);
  const pick = (arr) => {
    if (!arr.length) return null;
    const index = Math.floor(rng() * arr.length);
    return arr[index] || arr[arr.length - 1] || null;
  };

  const charactersWithArt = characters.filter((char) => {
    if (!char) return false;
    if (char.cover) return true;
    if (Array.isArray(char.gallery) && char.gallery.some(Boolean)) return true;
    return false;
  });
  const characterPool = charactersWithArt.length ? charactersWithArt : characters;
  const character = pick(characterPool);
  if (!character) {
    return { character: null, faction: null, location: null, power: null, backgrounds: [] };
  }

  const characterFactions = normaliseArray(character.faction);
  const characterLocations = normaliseArray(character.locations);
  const sortedPowers = (character.powers || [])
    .slice()
    .filter((entry) => entry && entry.name)
    .sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0));
  const primaryFaction = characterFactions[0] || null;
  const primaryLocation = characterLocations[0] || null;
  const topPower = sortedPowers[0]?.name || null;

  const factionMembers = primaryFaction
    ? characters.filter((char) => normaliseArray(char.faction).includes(primaryFaction))
    : [];
  const locationResidents = primaryLocation
    ? characters.filter((char) => normaliseArray(char.locations).includes(primaryLocation))
    : [];
  const powerWielders = topPower
    ? characters.filter((char) => (char.powers || []).some((p) => p.name === topPower))
    : [];

  const bringForward = (list) => {
    if (!character?.id) return list.slice();
    const seen = new Set();
    const ordered = [];
    [character, ...list].forEach((entry) => {
      if (!entry) return;
      const key = entry.id || entry.name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(entry);
    });
    return ordered;
  };

  const backgrounds = [character.cover, ...(character.gallery || [])].filter(Boolean);

  return {
    character,
    faction: primaryFaction ? { name: primaryFaction, members: bringForward(factionMembers).slice(0, 8) } : null,
    location: primaryLocation ? { name: primaryLocation, residents: bringForward(locationResidents).slice(0, 8) } : null,
    power: topPower ? { name: topPower, wielders: bringForward(powerWielders).slice(0, 8) } : null,
    backgrounds,
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
      char.sourceIndex = index;
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
  const sheetId =
    process.env.LOREMAKER_SHEET_ID || process.env.NEXT_PUBLIC_LOREMAKER_SHEET_ID || DEFAULT_SHEET_ID;
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
  const configuredSheet = process.env.LOREMAKER_SHEET_TAB;
  const sheetNames = Array.from(
    new Set([
      configuredSheet && configuredSheet.trim(),
      "Characters",
      ...FALLBACK_SHEET_NAMES,
      undefined,
    ].filter((name) => name !== ""))
  );

  let lastError;
  for (const name of sheetNames) {
    try {
      const url = name ? gvizUrl(sheetId, name) : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
      const res = await fetch(url);
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
