import { StatusPill } from "@/components/ui/status-pill";

// Page d'accueil temporaire. Ce n'est pas la landing définitive.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-wide text-wood-black sm:text-5xl">
        Prodigio OS
      </h1>
      <p className="mt-4 text-lg text-text-secondary">
        Fondations techniques initialisées
      </p>
      <div className="mt-8">
        <StatusPill>Moteur Mandats en construction</StatusPill>
      </div>
    </main>
  );
}
