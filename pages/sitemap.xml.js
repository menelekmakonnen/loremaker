import { loadCharacterLibrary, characterSlug, buildTaxonomies } from "../lib/characters";

const DEFAULT_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

function slugify(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlNode({ loc, changefreq = "weekly", priority = "0.5", lastmod }) {
  const lines = ["  <url>", `    <loc>${escapeXml(loc)}</loc>`, `    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`];
  if (lastmod) {
    lines.splice(3, 0, `    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  }
  lines.push("  </url>");
  return lines.join("\n");
}

function buildSitemap(characters, siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    buildUrlNode({ loc: siteUrl, changefreq: "daily", priority: "1.0", lastmod: today }),
  ];

  characters.forEach((character) => {
    if (!character || !character.name) return;
    const slug = characterSlug(character) || character.id || slugify(character.name);
    if (!slug) return;
    urls.push(
      buildUrlNode({
        loc: `${siteUrl}/characters/${slug}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: today,
      })
    );
  });

  const taxonomies = buildTaxonomies(characters);

  const indexEntries = [
    { path: "factions", changefreq: "weekly" },
    { path: "powers", changefreq: "weekly" },
    { path: "locations", changefreq: "weekly" },
    { path: "timelines", changefreq: "weekly" },
  ];

  indexEntries.forEach(({ path, changefreq }) => {
    urls.push(
      buildUrlNode({
        loc: `${siteUrl}/${path}`,
        changefreq,
        priority: "0.6",
        lastmod: today,
      })
    );
  });

  Object.entries(taxonomies).forEach(([key, entries]) => {
    const basePath = key;
    entries.forEach((entry) => {
      urls.push(
        buildUrlNode({
          loc: `${siteUrl}/${basePath}/${entry.slug}`,
          changefreq: "weekly",
          priority: "0.6",
          lastmod: today,
        })
      );
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }) {
  const characters = await loadCharacterLibrary();

  const xml = buildSitemap(characters, DEFAULT_SITE_URL);
  res.setHeader("Content-Type", "application/xml");
  res.write(xml);
  res.end();

  return { props: {} };
}
