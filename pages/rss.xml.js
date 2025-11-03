import fallbackCharacters from "../data/fallback-characters.json";
import {
  fetchCharactersFromSheets,
  characterSlug,
  ensureUniqueSlugs,
  fillDailyPowers,
  normaliseArray,
} from "../lib/characters";

const DEFAULT_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDescription(character) {
  const source = character.shortDesc || character.longDesc || "A legendary dossier from the LoreMaker Universe.";
  return source.length > 240 ? `${source.slice(0, 237).trimEnd()}…` : source;
}

function buildRss(characters, siteUrl) {
  const updated = new Date().toUTCString();
  const items = characters.slice(0, 60).map((character) => {
    if (!character || !character.name) return null;
    const slug = characterSlug(character);
    if (!slug) return null;
    const url = `${siteUrl}/characters/${slug}`;
    const description = escapeXml(formatDescription(character));
    const factions = normaliseArray(character.faction);
    const tags = normaliseArray(character.tags);
    const categories = [...factions, ...tags];
    const categoryXml = categories
      .filter(Boolean)
      .map((category) => `    <category>${escapeXml(category)}</category>`)
      .join("\n");

    const image = character.cover || character.gallery?.[0] || null;
    const enclosure = image
      ? `    <enclosure url="${escapeXml(image)}" type="image/jpeg" />\n`
      : "";

    return [
      "  <item>",
      `    <title>${escapeXml(character.name)}</title>`,
      `    <link>${escapeXml(url)}</link>`,
      `    <guid isPermaLink=\"true\">${escapeXml(url)}</guid>`,
      `    <description>${description}</description>`,
      enclosure + `    <pubDate>${updated}</pubDate>`,
      categoryXml,
      "  </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const rendered = items.filter(Boolean).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>LoreMaker Universe Codex</title>\n  <link>${escapeXml(
    siteUrl
  )}</link>\n  <description>The evolving roster of superheroes and fantasy legends from Menelek Makonnen's LoreMaker Universe.</description>\n  <language>en</language>\n  <lastBuildDate>${updated}</lastBuildDate>\n${rendered}\n</channel>\n</rss>`;
}

export default function RssFeed() {
  return null;
}

export async function getServerSideProps({ res }) {
  let characters = ensureUniqueSlugs(fallbackCharacters.map((entry) => fillDailyPowers(entry)));

  try {
    const fetched = await fetchCharactersFromSheets();
    if (Array.isArray(fetched) && fetched.length) {
      characters = ensureUniqueSlugs(fetched.map((entry) => fillDailyPowers(entry)));
    }
  } catch (error) {
    console.warn("[rss] Falling back to bundled characters", error);
  }

  const xml = buildRss(characters, DEFAULT_SITE_URL);

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.write(xml);
  res.end();

  return { props: {} };
}
