import { useState } from "react";
import { Headphones, BookOpen } from "lucide-react";
import { PodcastRail } from "@/components/home/podcast-rail";
import { BlogRail } from "@/components/home/blog-rail";
import { ShowsGrid } from "@/components/home/shows-grid";

type Tab = "listen" | "read";

export function ListenAndRead() {
  const [tab, setTab] = useState<Tab>("listen");
  return (
    <section>
      <div className="mb-2 flex justify-end px-1">
        <div className="inline-flex rounded-full bg-secondary p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setTab("listen")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
              tab === "listen" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Headphones className="h-3 w-3" /> Listen
          </button>
          <button
            type="button"
            onClick={() => setTab("read")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
              tab === "read" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <BookOpen className="h-3 w-3" /> Read
          </button>
        </div>
      </div>
      {tab === "listen" ? (
        <>
          <PodcastRail />
          <ShowsGrid />
        </>
      ) : (
        <BlogRail />
      )}
    </section>
  );
}
