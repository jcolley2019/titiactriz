import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

/**
 * BLOG.FIXES.1 — an unknown URL (and a draft or unknown post slug) answers 200
 * with this view: a soft 404. noindex keeps it out of the index, and its copy
 * is the site's, Spanish first.
 */
const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>{`${t("notFound.title")} | Cristyna Polentino`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="text-center" data-qa="not-found">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-2 text-xl text-muted-foreground">{t("notFound.title")}</p>
        <p className="mb-4 text-muted-foreground">{t("notFound.body")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("notFound.home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
