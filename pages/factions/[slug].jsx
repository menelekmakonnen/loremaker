import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies } from "../../lib/characters";
import { TaxonomyDetailLayout } from "../../components/taxonomy-layout";

export default function FactionDetailPage({ entry, related }) {
  if (!entry) {
    return null;
  }

  const metaTitle = `${entry.name} Faction | LoreMaker Universe`;
  const metaDescription = entry.summary || `Discover the ${entry.name} alliance within Menelek Makonnen's LoreMaker Universe.`;
  const prefilter = `/?prefilter=${encodeURIComponent(entry.filterKey)}:${encodeURIComponent(entry.name)}#characters-grid`;

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
      </Head>
      <TaxonomyDetailLayout
        entry={entry}
        basePath="/factions"
        typeLabel="Faction"
        typeLabelPlural="Factions"
        description={entry.summary}
        prefilterHref={prefilter}
        relatedEntries={related}
      />
    </>
  );
}

export async function getStaticPaths() {
  const characters = await loadCharacterLibrary();
  const { factions } = buildTaxonomies(characters);
  const paths = factions.map((entry) => ({ params: { slug: entry.slug } }));

  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const characters = await loadCharacterLibrary();
  const { factions } = buildTaxonomies(characters);
  const entry = factions.find((item) => item.slug === params?.slug);

  if (!entry) {
    return { notFound: true, revalidate: 300 };
  }

  const related = factions.filter((item) => item.slug !== entry.slug).slice(0, 6);

  return {
    props: {
      entry,
      related,
    },
    revalidate: 600,
  };
}
