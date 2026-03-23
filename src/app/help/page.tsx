import Link from "next/link";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-serif font-semibold border-b pb-2" style={{ color: "var(--hd-inverse-text)", borderColor: "var(--hd-tertiary-bg)" }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--hd-inverse-text)" }}>
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-base" style={{ color: "var(--hd-inverse-text)" }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-4 py-3 text-sm border" style={{ backgroundColor: "var(--hd-secondary-bg)", borderColor: "var(--hd-tertiary-bg)", color: "var(--hd-inverse-text)" }}>
      {children}
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
        style={{ backgroundColor: "var(--hd-accent)", color: "var(--hd-inverse-text)" }}
      >
        {number}
      </span>
      <p style={{ color: "var(--hd-inverse-text)" }}>{children}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <main className="min-h-screen p-6" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Page header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
            How it works
          </h1>
          <p className="text-sm" style={{ color: "var(--hd-subtle-text)" }}>
            Guide for organizers and participants
          </p>
        </div>

        {/* ── ORGANIZERS ──────────────────────────────────────────── */}
        <Section id="organizers" title="For organizers">

          <Subsection title="1. Create a tournament">
            <Step number={1}>Go to the home page and tap <strong>New Tournament</strong>.</Step>
            <Step number={2}>Enter a tournament name and date.</Step>
            <Step number={3}>
              Add each participant by name. Rank is optional — if you enter it (e.g. <em>5D</em>, <em>3K</em>), it will appear next to the player&apos;s name throughout the app.
            </Step>
            <Step number={4}>Tap <strong>Create Tournament</strong>. The app determines the format automatically based on how many players you entered.</Step>
            <Note>
              <strong>Format rules:</strong> 4–5 players → single round-robin (everyone plays everyone). 6 or more players → pools of 3 (with a pool of 4 here and there when the numbers require it), with the top player from each pool advancing to a single-elimination bracket.
            </Note>
          </Subsection>

          <Subsection title="2. Enter scores during pool play">
            <p>You will land on the manage page. Each match card shows the two players and four possible outcomes. Tap the correct result — standings update immediately.</p>
            <p>If you make a mistake, tap <strong>Edit</strong> on any completed match to correct it. There is no lock — you can edit scores at any time.</p>
            <Note>
              Keep this page open on a phone or tablet at the scoring table. The <strong>Public view ↗</strong> link in the top right opens a read-only version safe to share with participants or display on a screen.
            </Note>
          </Subsection>

          <Subsection title="3. Generate the elimination bracket">
            <p>When all pool matches are complete, a green button appears: <strong>Generate Elimination Bracket</strong>. Tap it once. The bracket is created automatically, seeded by pool finish position, with byes added as needed.</p>
            <p>Byes are assigned to the highest seeds, so the players who worked hardest in pools face the weakest opponents first.</p>
          </Subsection>

          <Subsection title="4. Run the bracket">
            <p>Elimination matches work the same as pool matches — tap the result on each match card. The winner is automatically placed into the next round. When the final is scored, the tournament moves to <strong>Complete</strong> status and the final report appears.</p>
          </Subsection>

        </Section>

        {/* ── PARTICIPANTS ──────────────────────────────────────────── */}
        <Section id="participants" title="For participants">

          <Subsection title="Reading the standings">
            <p>During pool play, each pool shows a live standings table ranked by total flags. The player at the top of each pool at the end advances to the elimination bracket.</p>
            <p>The view page refreshes automatically every few seconds — no need to reload.</p>
          </Subsection>

          <Subsection title="Why did that player advance and not me?">
            <p>If two or more players finish a pool with the same number of flags, the app breaks the tie in order:</p>
            <div className="space-y-2 pl-2">
              <div className="flex gap-2">
                <span className="font-bold" style={{ color: "var(--hd-accent)" }}>1.</span>
                <p><strong>Head-to-head flags.</strong> Who scored more flags in the match directly between the tied players?</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold" style={{ color: "var(--hd-accent)" }}>2.</span>
                <p><strong>Flag differential.</strong> Across all their pool matches, who has the bigger gap between flags scored and flags conceded?</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold" style={{ color: "var(--hd-accent)" }}>3.</span>
                <p><strong>Run-off match.</strong> If a circular 3-way tie remains (A beat B, B beat C, C beat A, all with equal margins), those players play a fresh mini round-robin to break it. The bracket waits until the run-off is complete.</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold" style={{ color: "var(--hd-accent)" }}>4.</span>
                <p><strong>Virtual rock-paper-scissors (backstop only).</strong> If the run-off itself produces another circular tie, a simulated janken bout decides. This is deterministic — the same players in the same tournament always get the same result.</p>
              </div>
            </div>
            <Note>
              The standings table always shows the current ranking in tiebreaker order, so the player listed higher is the one who would advance if the pool ended right now.
            </Note>
          </Subsection>

          <Subsection title="Finding your next match">
            <p>In the elimination bracket section, each match card shows the two players and the current score (if played). Your name will appear as soon as the previous round&apos;s result is entered. If it shows <em>TBD</em>, the previous match has not been scored yet.</p>
          </Subsection>

        </Section>

        {/* ── JODO BASICS ──────────────────────────────────────────── */}
        <Section id="jodo-basics" title="Jodo match basics">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--hd-subtle-text)" }}>
            Background — for those new to the format
          </p>

          <Subsection title="How a match is scored">
            <p>A Jodo match is judged by a panel. Judges award flags (旗, <em>hata</em>) to indicate which player performed the technique more correctly. The player who collects more flags wins the match.</p>
            <p>Matches in this system are scored as either a <strong>3–0</strong> (clean sweep — all judges agreed) or <strong>2–1</strong> (one judge sided with the other player).</p>
          </Subsection>

          <Subsection title="What the flag counts mean">
            <p>In the standings, the <strong>Flags</strong> column shows total flags a player has collected across all their matches — not the number of wins. A player who wins two matches 3–0 has 6 flags; one who wins two matches 2–1 has 4 flags. Both have two wins, but the first ranks higher.</p>
          </Subsection>
        </Section>

        {/* Back link */}
        <div className="pb-6">
          <Link href="/" className="text-sm hover:underline" style={{ color: "var(--hd-accent-secondary)" }}>
            ← Back to home
          </Link>
        </div>

      </div>
    </main>
  );
}
