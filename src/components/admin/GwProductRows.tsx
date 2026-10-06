import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GW_PRODUCT_NAME_MAX,
  GW_PRODUCT_URL_MAX,
  MAX_GW_PRODUCTS,
  gwProductUrlInvalid,
  type GwKind,
  type GwProduct,
} from "@/lib/blog";

/**
 * ADMIN.FIXES.1 — a Green World piece's products, as rows: a name and a link
 * per row, in order, add and remove, at most MAX_GW_PRODUCTS. One editor for the
 * Blog's entry ("admin" look: the admin's own inputs) and the Studio's Green
 * World press ("studio" look: studio.css).
 *
 * Producto: "Productos", always at least one row to fill in (its last row can
 * be emptied, not removed). Capacitación and Negocio: "Productos mencionados",
 * empty until Titi adds the products the piece mentions.
 *
 * A link is http(s) or empty (empty goes to the Green World shop). A link that
 * is neither is marked under its field while `showErrors` (the Blog after a
 * Save attempt, the Studio as she types); the caller refuses to save or to
 * generate meanwhile. Blank rows stay while she edits; asGwProducts drops them
 * from what is stored.
 */

const BLANK: GwProduct = { name: "", url: "" };

type Props = {
  rows: GwProduct[];
  onChange: (rows: GwProduct[]) => void;
  kind: GwKind;
  /** The line under the rows: what an empty link does, in this surface's words. */
  help: string;
  showErrors: boolean;
  disabled?: boolean;
  /** data-qa prefix: `${qa}-products`, `${qa}-product-row`, `${qa}-product-name`… */
  qa: string;
  look: "admin" | "studio";
};

const GwProductRows = ({ rows, onChange, kind, help, showErrors, disabled = false, qa, look }: Props) => {
  const { t } = useTranslation();
  const uid = useId();
  const about = kind === "producto";
  const shown = about && rows.length === 0 ? [BLANK] : rows;
  const numbered = shown.length > 1;
  const studio = look === "studio";

  const edit = (i: number, patch: Partial<GwProduct>) =>
    onChange(shown.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(shown.filter((_, j) => j !== i));
  const add = () => onChange([...shown, BLANK]);

  const labelId = `${uid}-label`;
  const helpId = `${uid}-help`;
  const nameLabel = (i: number) => `${t("admin.blog.fieldProductName")}${numbered ? ` ${i + 1}` : ""}`;
  const urlLabel = (i: number) => `${t("admin.blog.fieldProductUrl")}${numbered ? ` ${i + 1}` : ""}`;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-qa={`${qa}-products`}
      data-kind={kind}
      className={studio ? "st-products" : "space-y-3"}
    >
      <p id={labelId} className={studio ? "st-field-label" : "text-foreground text-sm font-medium"}>
        {about ? t("admin.blog.productsLabel") : t("admin.blog.productsMentioned")}
      </p>

      {shown.length > 0 && (
        <ol className={studio ? "st-product-list" : "space-y-3"}>
          {shown.map((row, i) => {
            const nameId = `${uid}-name-${i}`;
            const urlId = `${uid}-url-${i}`;
            const errorId = `${uid}-error-${i}`;
            const invalid = showErrors && gwProductUrlInvalid(row);
            const removable = !(about && shown.length === 1);
            const removeLabel = t("admin.blog.productRemove", { n: i + 1 });
            return (
              <li
                key={i}
                data-qa={`${qa}-product-row`}
                className={
                  studio
                    ? "st-product-row"
                    : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border p-3"
                }
              >
                <div className={studio ? "st-product-fields" : "grid min-w-0 gap-3 md:grid-cols-2"}>
                <div className={studio ? "st-product-field" : "min-w-0 space-y-1.5"}>
                  {studio ? (
                    <label className="st-field-label" htmlFor={nameId}>
                      {nameLabel(i)}
                    </label>
                  ) : (
                    <Label htmlFor={nameId} className="text-foreground text-sm font-medium">
                      {nameLabel(i)}
                    </Label>
                  )}
                  {studio ? (
                    <input
                      id={nameId}
                      data-qa={`${qa}-product-name`}
                      className="st-input mt-2"
                      maxLength={GW_PRODUCT_NAME_MAX}
                      value={row.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                      disabled={disabled}
                    />
                  ) : (
                    <Input
                      id={nameId}
                      data-qa={`${qa}-product-name`}
                      maxLength={GW_PRODUCT_NAME_MAX}
                      value={row.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                      disabled={disabled}
                    />
                  )}
                </div>
                <div className={studio ? "st-product-field" : "min-w-0 space-y-1.5"}>
                  {studio ? (
                    <label className="st-field-label" htmlFor={urlId}>
                      {urlLabel(i)}
                    </label>
                  ) : (
                    <Label htmlFor={urlId} className="text-foreground text-sm font-medium">
                      {urlLabel(i)}
                    </Label>
                  )}
                  {studio ? (
                    <input
                      id={urlId}
                      data-qa={`${qa}-product-url`}
                      type="url"
                      inputMode="url"
                      className="st-input mt-2"
                      maxLength={GW_PRODUCT_URL_MAX}
                      placeholder="https://"
                      value={row.url}
                      onChange={(e) => edit(i, { url: e.target.value })}
                      disabled={disabled}
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={invalid ? errorId : helpId}
                    />
                  ) : (
                    <Input
                      id={urlId}
                      data-qa={`${qa}-product-url`}
                      type="url"
                      inputMode="url"
                      maxLength={GW_PRODUCT_URL_MAX}
                      placeholder="https://"
                      value={row.url}
                      onChange={(e) => edit(i, { url: e.target.value })}
                      disabled={disabled}
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={invalid ? errorId : helpId}
                    />
                  )}
                  {invalid && (
                    <p
                      id={errorId}
                      data-qa={`${qa}-product-url-error`}
                      role="alert"
                      className={studio ? "st-error mt-1" : "text-xs text-destructive"}
                    >
                      {t("admin.blog.productUrlInvalid")}
                    </p>
                  )}
                </div>
                </div>
                {removable &&
                  (studio ? (
                    <button
                      type="button"
                      data-qa={`${qa}-product-remove`}
                      className="st-btn st-btn-danger st-product-remove"
                      aria-label={removeLabel}
                      title={removeLabel}
                      onClick={() => remove(i)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-qa={`${qa}-product-remove`}
                      aria-label={removeLabel}
                      title={removeLabel}
                      onClick={() => remove(i)}
                      disabled={disabled}
                      className="text-muted-foreground hover:text-destructive md:mt-7"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </Button>
                  ))}
              </li>
            );
          })}
        </ol>
      )}

      <div className={studio ? "st-product-foot" : "flex flex-wrap items-center gap-x-3 gap-y-2"}>
        {studio ? (
          <button
            type="button"
            data-qa={`${qa}-product-add`}
            className="st-btn"
            onClick={add}
            disabled={disabled || shown.length >= MAX_GW_PRODUCTS}
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t("admin.blog.productAdd")}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-qa={`${qa}-product-add`}
            onClick={add}
            disabled={disabled || shown.length >= MAX_GW_PRODUCTS}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t("admin.blog.productAdd")}
          </Button>
        )}
        <p id={helpId} data-qa={`${qa}-products-help`} className={studio ? "st-caption" : "text-xs text-muted-foreground"}>
          {help}
        </p>
      </div>
    </div>
  );
};

export default GwProductRows;
