import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">Taikai Manager</h1>
        <p className="text-gray-600">Hoshu Dojo tournament management</p>
        <Link
          href="/create"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          New Tournament
        </Link>
      </div>
    </main>
  );
}
