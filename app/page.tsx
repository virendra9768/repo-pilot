import { ImportForm } from "@/features/repository-import/ImportForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">RepoPilot</h1>
        <p className="mt-3 text-neutral-500">
          Paste a GitHub repo and get an AI onboarding guide: overview, a
          &ldquo;start here&rdquo; reading path, and an interactive execution-flow map.
        </p>
      </div>
      <ImportForm />
      <p className="mt-10 text-xs text-neutral-400">
        Deterministic analysis + Gemini. Public GitHub repos only.
      </p>
    </main>
  );
}
