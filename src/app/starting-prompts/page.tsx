import Link from "next/link";
import StartingPrompt from "@/components/StartingPrompt";

export default function StartingPromptsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0e102a] via-[#13204a] to-[#134780] p-3 sm:p-5">
      <div className="min-h-[calc(100vh-2.5rem)] border-4 border-[#d5def0] px-4 py-6 sm:px-8">
        <header className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-2">
          <Link
            href="/manually-assigned"
            aria-label="Back to Assign Groups"
            className="rounded-lg bg-[#d5def0] text-center text-2xl text-[#0e102a] hover:bg-white"
          >
            ←
          </Link>
          <h1 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Assign Starting Prompts
          </h1>
        </header>

        <div className="mx-auto mt-10 max-w-lg">
          <StartingPrompt />
        </div>
      </div>
    </main>
  );
}