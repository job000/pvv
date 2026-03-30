import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-zinc-950">
      <main className="w-full max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#e31c24]">
          PVV
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Prosess vurdering verktøy
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Vurder RPA-kandidater med beregninger i tråd med UiPath Automation Hub
          (automatiseringspotensial, gjennomførbarhet, implementasjon og årlige KPI-er).
        </p>
        <Link
          href="/rpa-vurdering"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#e31c24] px-8 text-sm font-medium text-white transition hover:bg-[#c41820]"
        >
          Åpne vurderingsverktøy
        </Link>
      </main>
    </div>
  );
}
