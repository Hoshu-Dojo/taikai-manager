import Link from "next/link";

export default function Home() {
  return (
    <main
      className="flex flex-col items-center justify-center flex-1 p-8"
      style={{ backgroundColor: "var(--hd-page-bg)" }}
    >
      <div
        className="max-w-md w-full text-center space-y-6 rounded-2xl p-10"
        style={{ backgroundColor: "var(--hd-primary-bg)" }}
      >
        <h1
          className="font-serif text-4xl font-semibold"
          style={{ color: "var(--hd-primary-text)" }}
        >
          Taikai Manager
        </h1>
        <p style={{ color: "var(--hd-primary-text)", opacity: 0.7 }}>
          Hoshu Dojo tournament management
        </p>
        <Link
          href="/create"
          className="inline-block font-semibold px-8 py-3 rounded-lg transition-colors"
          style={{
            backgroundColor: "var(--hd-accent)",
            color: "var(--hd-inverse-text)",
          }}
        >
          New Tournament
        </Link>
      </div>
    </main>
  );
}
