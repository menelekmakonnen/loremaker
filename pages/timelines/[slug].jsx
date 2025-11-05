import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies } from "../../lib/characters";
import { TaxonomyDetailLayout } from "../../components/taxonomy-layout";

export default function TimelineDetailPage({ entry, related }) {
  if (!entry) {
    return null;
  }

  const metaTitle = `${entry.name} Timeline | LoreMaker Universe`;
  const descriptor = entry.summary || `Follow the ${entry.name} era within Menelek Makonnen's LoreMaker Universe.`;
  const prefilter = `/?prefilter=${encodeURIComponent(entry.filterKey)}:${encodeURIComponent(entry.name)}#characters-grid`;

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={descriptor} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={descriptor} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={descriptor} />
      </Head>
      <TaxonomyDetailLayout
        entry={entry}
        basePath="/timelines"
        typeLabel="Timeline"
        typeLabelPlural="Timelines"
        description={descriptor}
        prefilterHref={prefilter}
        relatedEntries={related}
      />
    </>
  );
}

export async function getStaticPaths() {
  const characters = await loadCharacterLibrary();
  const { timelines } = buildTaxonomies(characters);
  const paths = timelines.map((entry) => ({ params: { slug: entry.slug } }));

  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const characters = await loadCharacterLibrary();
  const { timelines } = buildTaxonomies(characters);
  const entry = timelines.find((item) => item.slug === params?.slug);

  if (!entry) {
    return { notFound: true, revalidate: 300 };
  }

  const related = timelines.filter((item) => item.slug !== entry.slug).slice(0, 6);

  return {
    props: {
      entry,
      related,
    },
    revalidate: 600,
  };
}
