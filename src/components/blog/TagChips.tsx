import { GOLD_AIR, GOLD_RULE, IVORY_DIM } from "./tokens";

/** A post's tags: hairline chips — a 0.4 gold edge over a 0.08 wash, hard corners. */
const TagChips = ({ tags, qa, label }: { tags: string[]; qa: string; label?: string }) =>
  tags.length ? (
    <ul data-qa={qa} aria-label={label} className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className="text-caps px-2.5 py-1"
          style={{ color: IVORY_DIM, border: `1px solid ${GOLD_RULE}`, backgroundColor: GOLD_AIR }}
        >
          {tag}
        </li>
      ))}
    </ul>
  ) : null;

export default TagChips;
