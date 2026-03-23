import Image from "next/image";

export function Header() {
  return (
    <header
      className="print:hidden flex items-center gap-4 px-6 py-3 border-b"
      style={{
        backgroundColor: "var(--hd-secondary-bg)",
        borderColor: "var(--hd-tertiary-bg)",
      }}
    >
      <Image
        src="/hoshu-dojo-logo.svg"
        alt="Hoshu Dojo"
        width={36}
        height={36}
        style={{ filter: "brightness(0) invert(1)" }}
      />
      <div>
        <div
          className="font-sans font-bold text-sm tracking-widest uppercase leading-tight"
          style={{ color: "var(--hd-inverse-text)" }}
        >
          Hoshu Dojo
        </div>
        <div
          className="font-sans font-medium text-xs tracking-widest uppercase"
          style={{ color: "var(--hd-subtle-text)" }}
        >
          Taikai
        </div>
      </div>
    </header>
  );
}
