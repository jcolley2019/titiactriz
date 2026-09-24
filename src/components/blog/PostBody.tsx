import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { BODY_TEXT, GOLD, GOLD_RULE, IVORY } from "./tokens";

/**
 * BLOG.1 — a post's markdown in the site's grammar. react-markdown + remark-gfm,
 * and deliberately NO rehype-raw: whatever is typed renders as text, never as
 * HTML.
 *
 * The page's own title is the H1, so a markdown "#" steps down to the same H2 a
 * "##" makes. Headings are the display face; everything below them is the
 * Label step in gold (an eyebrow inside the text). Paragraphs sit at the Body
 * step's ceiling, 0.95rem, held fixed: the fluid step bottoms out at 0.7rem on a
 * phone, which is right for a caption and wrong for an article.
 */

const BODY = BODY_TEXT;

const Heading2 = ({ children }: { children?: React.ReactNode }) => (
  <h2
    className="mt-12 mb-4 leading-tight"
    style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: IVORY }}
  >
    {children}
  </h2>
);

const Heading3 = ({ children }: { children?: React.ReactNode }) => (
  <h3 className="text-caps mt-10 mb-3" style={{ color: GOLD }}>
    {children}
  </h3>
);

const isInternal = (href: string | undefined) => !!href && href.startsWith("/") && !href.startsWith("//");

const components: Components = {
  h1: ({ children }) => <Heading2>{children}</Heading2>,
  h2: ({ children }) => <Heading2>{children}</Heading2>,
  h3: ({ children }) => <Heading3>{children}</Heading3>,
  h4: ({ children }) => <Heading3>{children}</Heading3>,
  h5: ({ children }) => <Heading3>{children}</Heading3>,
  h6: ({ children }) => <Heading3>{children}</Heading3>,
  p: ({ children }) => (
    <p className="my-5" style={BODY}>
      {children}
    </p>
  ),
  a: ({ href, children }) =>
    isInternal(href) ? (
      <Link to={href!} className="underline underline-offset-4 transition-colors duration-300 hover:text-gold-light" style={{ color: GOLD }}>
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 transition-colors duration-300 hover:text-gold-light"
        style={{ color: GOLD }}
      >
        {children}
      </a>
    ),
  ul: ({ children }) => (
    <ul className="my-5 list-disc space-y-2 pl-5 marker:text-[#C9A55C]" style={BODY}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-5 list-decimal space-y-2 pl-5 marker:text-[#C9A55C]" style={BODY}>
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-8 pl-5 italic [&_p]:my-2" style={{ borderLeft: `1px solid ${GOLD_RULE}` }}>
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 500, color: IVORY }}>{children}</strong>,
  hr: () => <hr className="my-12 border-0 h-px" style={{ backgroundColor: GOLD_RULE }} />,
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="my-8 block h-auto max-w-full" />
  ),
  code: ({ children }) => (
    <code className="px-1 font-mono" style={{ fontSize: "0.75rem", backgroundColor: "#12100c", color: IVORY }}>
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-left" style={BODY}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-caps py-2 pr-4" style={{ color: GOLD, borderBottom: `1px solid ${GOLD_RULE}` }}>
      {children}
    </th>
  ),
  td: ({ children }) => <td className="py-2 pr-4 align-top">{children}</td>,
};

const PostBody = ({ markdown }: { markdown: string }) => (
  <div data-qa="blog-post-body" className="break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  </div>
);

export default PostBody;
