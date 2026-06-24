// Thin notice shown only on the static GitHub Pages showcase build (NEXT_PUBLIC_SHOWCASE=1).
// The deployed site is UI only: the live nanopayment flow needs the local backend (attestor +
// Gateway agent), which holds testnet keys and can't be public. This sets that expectation so a
// visitor understands why the buttons don't move real USDC here.
export function ShowcaseBanner() {
  if (process.env.NEXT_PUBLIC_SHOWCASE !== "1") return null;
  return (
    <div className="w-full bg-amber-500/15 text-amber-200 text-xs sm:text-sm px-4 py-2 text-center border-b border-amber-500/25">
      Showcase build. This is the live Arclight UI, but the nanopayment flow runs against a local
      backend, so the buttons here won&apos;t move real USDC. Run it locally for the working demo, see the{" "}
      <a
        href="https://github.com/mgx96/arclight"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-amber-100"
      >
        repo
      </a>
      .
    </div>
  );
}
