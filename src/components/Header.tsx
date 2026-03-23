import Image from "next/image";

export function Header() {
  return (
    <header
      className="print:hidden flex items-center gap-4 px-6 py-4 border-b"
      style={{
        backgroundColor: "var(--hd-secondary-bg)",
        borderColor: "var(--hd-tertiary-bg)",
      }}
    >
      <Image
        src="/hoshu-dojo-logo.svg"
        alt="Hoshu Dojo"
        width={40}
        height={40}
        style={{ filter: "brightness(0) invert(1)" }}
      />
      <div>
        <div
          className="font-serif text-lg font-semibold leading-tight"
          style={{ color: "var(--hd-inverse-text)" }}
        >
          Hoshu Dojo
        </div>
        <div
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--hd-subtle-text)" }}
        >
          Taikai
        </div>
      </div>
    </header>
  );
}
