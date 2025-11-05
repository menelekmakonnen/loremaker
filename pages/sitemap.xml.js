import fallbackCharacters from "../data/fallback-characters.json";
import { fetchCharactersFromSheets, fillDailyPowers } from "../lib/characters";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

function slugifyId(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function loadCharacters() {
  try {
    const remote = await fetchCharactersFromSheets();
    if (remote?.length) {
      return remote;
    }
  } catch (error) {
    console.warn("[sitemap] Falling back to bundled characters", error);
  }
  return fallbackCharacters.map((char) => fillDailyPowers(char));
}

export async function getServerSideProps({ res }) {
  const characters = await loadCharacters();
  const now = new Date().toISOString();
  const urls = [
    {
      loc: `${SITE_URL}/`,
      changefreq: "daily",
      priority: "1.0",
      lastmod: now,
    },
    ...characters
      .map((character) => {
        const slug = character?.id || slugifyId(character?.name);
        if (!slug) return null;
        return {
          loc: `${SITE_URL}/characters/${slug}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod: now,
        };
      })
      .filter(Boolean),
  ];

  const body = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (url) =>
        [
          "  <url>",
          `    <loc>${url.loc}</loc>`,
          url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : null,
          url.changefreq ? `    <changefreq>${url.changefreq}</changefreq>` : null,
          url.priority ? `    <priority>${url.priority}</priority>` : null,
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n")
    ),
    "</urlset>",
  ].join("\n");

  res.setHeader("Content-Type", "text/xml");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
