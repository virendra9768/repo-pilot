import { Compass, LayoutDashboard, ListOrdered, Workflow } from "lucide-react";
import { ImportForm } from "@/features/repository-import/ImportForm";
import { RecentRepos } from "@/features/repository-import/RecentRepos";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Instant Overview",
    body: "Purpose, architecture, and the files that actually matter — summarized.",
  },
  {
    icon: ListOrdered,
    title: "Guided Start",
    body: "A reading path through the codebase, ordered the way a mentor would teach it.",
  },
  {
    icon: Workflow,
    title: "Execution Flow",
    body: "Ask how anything works and watch it render as an interactive flow map.",
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-6">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[600px]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-[-120px] -z-0 h-[440px]"
        style={{
          background:
            "radial-gradient(50% 55% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />

      <section className="relative z-10 flex w-full max-w-3xl flex-col items-center pt-32 text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          style={{ animation: "rp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <Compass className="h-3.5 w-3.5 text-accent-bright" />
          AI repository onboarding
        </div>

        <h1
          className="mt-7 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
          style={{ animation: "rp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.06s both" }}
        >
          Understand any codebase
          <br />
          in{" "}
          <span className="bg-linear-to-r from-accent-bright to-accent-2 bg-clip-text text-transparent">
            minutes
          </span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground"
          style={{ animation: "rp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.12s both" }}
        >
          Paste a GitHub repository. RepoPilot analyzes the real code and generates
          an onboarding guide, a learning path, and a live execution map.
        </p>

        <div
          className="mt-10 w-full"
          style={{ animation: "rp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.18s both" }}
        >
          <ImportForm />
        </div>
      </section>

      <div className="relative z-10 flex w-full flex-col items-center">
        <RecentRepos />
      </div>

      <section
        className="relative z-10 mt-24 grid w-full max-w-4xl gap-4 pb-24 sm:grid-cols-3"
        style={{ animation: "rp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.26s both" }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent-bright transition-transform group-hover:scale-105">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
