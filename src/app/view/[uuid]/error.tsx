"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
        Could not load standings
      </h1>
      <p className="text-sm max-w-sm" style={{ color: "var(--hd-subtle-text)" }}>
        {error.message || "An unexpected error occurred. Check your connection and try again."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded text-sm font-medium"
        style={{ backgroundColor: "var(--hd-accent)", color: "var(--hd-inverse-text)" }}
      >
        Try again
      </button>
    </main>
  );
}
