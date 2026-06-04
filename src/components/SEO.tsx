import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

const SITE = "https://titiactriz.com";
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

interface SEOProps {
  path: string; // e.g. "/", "/work"
  title: string;
  description: string;
  image?: string;
  type?: string; // og:type
  children?: React.ReactNode; // extra tags (e.g. JSON-LD)
}

/**
 * Per-route SEO: canonical, hreflang (es/en/x-default), Open Graph, Twitter card.
 * Visible page copy stays bilingual via i18n; this component only emits head tags.
 */
const SEO = ({
  path,
  title,
  description,
  image = DEFAULT_IMAGE,
  type = "website",
  children,
}: SEOProps) => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").startsWith("en") ? "en" : "es";
  const url = `${SITE}${path}`;
  const ogLocale = lang === "en" ? "en_US" : "es_CO";
  const ogLocaleAlt = lang === "en" ? "es_CO" : "en_US";
  const absImage = image.startsWith("http") ? image : `${SITE}${image}`;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* hreflang alternates (single-domain bilingual app; routes are language-neutral) */}
      <link rel="alternate" hrefLang="es" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Open Graph */}
      <meta property="og:site_name" content="Cristyna Polentino" />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={ogLocaleAlt} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absImage} />

      {children}
    </Helmet>
  );
};

export default SEO;
