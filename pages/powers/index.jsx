import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies } from "../../lib/characters";
import { TaxonomyIndexLayout } from "../../components/taxonomy-layout";

const META_TITLE = "Powers of the LoreMaker Universe | Menelek Makonnen";
const META_DESCRIPTION =
  "Search abilities, arcane talents, and mythic gifts wielded by heroes and villains across the LoreMaker Universe.";

export default function PowersIndexPage({ entries, characters }) {
  return (
    <>
      <Head>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={META_TITLE} />
        <meta name="twitter:description" content={META_DESCRIPTION} />
      </Head>
      <TaxonomyIndexLayout
        title="Power Index"
        description="Survey the signature abilities and rare talents that course through Menelek Makonnen's LoreMaker Universe."
        entries={entries}
        basePath="/powers"
        characters={characters}
      />
    </>
  );
}

export async function getStaticProps() {
  const characters = await loadCharacterLibrary();
  const { powers } = buildTaxonomies(characters);

  return {
    props: {
      entries: powers,
      characters,
    },
    revalidate: 600,
  };
}
