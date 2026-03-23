import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
        Tournament not found
      </h1>
      <p className="text-sm max-w-sm" style={{ color: "var(--hd-subtle-text)" }}>
        This link may be incorrect or the tournament may have been removed.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded text-sm font-medium"
        style={{ backgroundColor: "var(--hd-accent)", color: "var(--hd-inverse-text)" }}
      >
        Go to home
      </Link>
    </main>
  );
}
