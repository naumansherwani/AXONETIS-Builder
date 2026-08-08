/**
 * PHASE 12.3 — HELP CENTER.
 * Fuzzy instant search, category list, markdown article viewer (with code
 * blocks), optional YouTube/Vimeo embed, and "Contact support" which prefills
 * the Unified Chat composer with Jimmy.
 * Content lives in Supabase 3 `help_articles` — no dummy articles.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LifeBuoy, Loader2, MessageSquare, RefreshCw, Search } from "lucide-react";
import {
  fetchHelpArticles,
  searchArticles,
  toEmbedUrl,
  type HelpArticle,
} from "@/lib/help-api";

/** Minimal, dependency-free markdown renderer: headings, code, lists, bold, links. */
function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => source.split(/```/), [source]);
  return (
    <div className="space-y-2 text-[12px] leading-relaxed text-foreground/85">
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="fb-no-scrollbar overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0b0b11] p-2.5 font-mono text-[11px] text-emerald-200"
          >
            <code>{block.replace(/^[\w-]*\n/, "")}</code>
          </pre>
        ) : (
          <div key={i} className="space-y-1.5">
            {block
              .split("\n")
              .filter((l) => l.trim().length > 0)
              .map((line, j) => {
                if (line.startsWith("### "))
                  return (
                    <h5 key={j} className="pt-1 text-[12px] font-semibold text-foreground/95">
                      {line.slice(4)}
                    </h5>
                  );
                if (line.startsWith("## "))
                  return (
                    <h4 key={j} className="pt-1 text-[13px] font-semibold text-foreground">
                      {line.slice(3)}
                    </h4>
                  );
                if (line.startsWith("# "))
                  return (
                    <h3 key={j} className="text-[14px] font-bold text-foreground">
                      {line.slice(2)}
                    </h3>
                  );
                if (/^\s*[-*]\s/.test(line))
                  return (
                    <div key={j} className="flex gap-2 pl-1">
                      <span className="text-[#ff7480]">·</span>
                      <span>{inline(line.replace(/^\s*[-*]\s/, ""))}</span>
                    </div>
                  );
                return <p key={j}>{inline(line)}</p>;
              })}
          </div>
        ),
      )}
    </div>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code
          key={i}
          className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-emerald-200"
        >
          {p.slice(1, -1)}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

export default function HelpPanel() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<HelpArticle | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const snap = await fetchHelpArticles();
    setArticles(snap.articles);
    setError(snap.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => String(a.category)))).sort(),
    [articles],
  );

  const results = useMemo(() => {
    const scoped = category ? articles.filter((a) => a.category === category) : articles;
    return searchArticles(scoped, query);
  }, [articles, category, query]);

  const askJimmy = useCallback((topic?: string) => {
    window.dispatchEvent(
      new CustomEvent("axonetis:jimmy-ask", {
        detail: {
          text: topic
            ? `Jimmy, mujhe is topic par help chahiye: "${topic}". Step by step batao.`
            : "Jimmy, mujhe support chahiye — ",
        },
      }),
    );
  }, []);

  if (open) {
    const embed = toEmbedUrl(open.video_url);
    return (
      <div className="space-y-3">
        <button
          onClick={() => setOpen(null)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Help Center
        </button>
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[#ff7480]">
            {open.category}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold text-foreground">{open.title}</h3>
          <div className="mt-0.5 font-mono text-[9.5px] text-muted-foreground/60">
            Updated {new Date(open.updated_at).toLocaleDateString()}
          </div>
        </div>
        {embed && (
          <div className="aspect-video overflow-hidden rounded-lg border border-white/[0.08]">
            <iframe
              src={embed}
              title={open.title}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <Markdown source={open.body_md} />
        <button
          onClick={() => askJimmy(open.title)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/[0.14]"
        >
          <MessageSquare className="h-3 w-3" /> Ask Jimmy about this
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — instant, fuzzy"
          className="w-full rounded-md border border-white/[0.08] bg-[#0c0c13] py-2 pl-8 pr-8 text-[11.5px] text-foreground/90 outline-none placeholder:text-muted-foreground/50 focus:border-[#E50914]/40"
        />
        <button
          onClick={() => void load()}
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          title="Reload articles"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              category === null
                ? "border-[#E50914]/40 bg-[#E50914]/[0.1] text-[#ff7480]"
                : "border-white/[0.08] text-muted-foreground hover:bg-white/[0.05]"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                category === c
                  ? "border-[#E50914]/40 bg-[#E50914]/[0.1] text-[#ff7480]"
                  : "border-white/[0.08] text-muted-foreground hover:bg-white/[0.05]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {results.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpen(a)}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.012] p-2.5 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.03]"
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
              {a.category}
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-foreground/95">{a.title}</div>
            {a.summary && (
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                {a.summary}
              </div>
            )}
          </button>
        ))}

        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.012] p-5 text-center">
            <LifeBuoy className="h-6 w-6 text-muted-foreground/60" />
            <div className="text-[11.5px] text-muted-foreground">
              {articles.length === 0
                ? "Koi help article publish nahi hua — `help_articles` mein rows daalo."
                : "Is search par kuch nahi mila."}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => askJimmy()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/[0.14]"
      >
        <MessageSquare className="h-3 w-3" /> Contact support (Jimmy)
      </button>

      {error && (
        <div className="rounded-md border border-[#E50914]/30 bg-[#E50914]/[0.06] p-2 text-[11px] text-[#ff7480]">
          {error}
        </div>
      )}
    </div>
  );
}
