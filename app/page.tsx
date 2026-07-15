import { Compass, LayoutDashboard, ListOrdered, Workflow } from "lucide-react";
import { ImportForm } from "@/features/repository-import/ImportForm";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Overview",
    body: "Purpose, architecture, tech stack, and the folders that matter.",
  },
  {
    icon: ListOrdered,
    title: "Start Here",
    body: "A guided reading order — what to open first and why.",
  },
  {
    icon: Workflow,
    title: "Execution Flow",
    body: "Ask how something works, see a clickable flow diagram.",
  },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-20">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(40% 60% at 50% 0%, color-mix(in oklab, var(--accent) 35%, transparent), transparent)",
        }}
      />

      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Compass className="h-3.5 w-3.5 text-accent" />
          AI repository onboarding
        </div>
        <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Understand any repo in <span className="text-accent">minutes</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-muted-foreground">
          Paste a GitHub repository and get an AI onboarding guide grounded in a
          real static analysis of the code.
        </p>
      </div>

      <div className="mt-10 flex w-full justify-center">
        <ImportForm />
      </div>

      <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <f.icon className="h-5 w-5 text-accent" />
            <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Deterministic analysis + Gemini · public GitHub repos only
      </p>
    </main>
  );
}
