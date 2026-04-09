"use client";

export default function SectionCommunity() {
  return (
    <footer id="community" className="bg-o7-dark border-t border-o7-green-mid/20 py-16 px-4">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Links */}
        <div className="flex justify-center gap-8">
          <a href="https://twitter.com/OrchardSeven" target="_blank" rel="noreferrer"
            className="text-o7-cream/60 hover:text-o7-gold transition font-body text-sm">
            Twitter
          </a>
          <a href="#" className="text-o7-cream/60 hover:text-o7-gold transition font-body text-sm">
            Discord
          </a>
          <a href="https://explorer.solana.com/address/DvVEq5v26rdDsaehVPL7cjNx54wpbE9f7m11UuitZeGQ?cluster=devnet"
            target="_blank" rel="noreferrer"
            className="text-o7-cream/60 hover:text-o7-gold transition font-body text-sm">
            Explorer
          </a>
        </div>

        {/* Credits */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto">
            <img src="/assets/o7-logo.png" alt="O7" className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="w-full h-full rounded-full border border-o7-gold/20 flex items-center justify-center"
              style={{ marginTop: "-100%" }}>
              <span className="font-pixel text-o7-gold text-xs">O7</span>
            </div>
          </div>
          <p className="font-pixel text-o7-cream/30 text-[8px]">ORCHARD 7</p>
          <p className="text-xs text-o7-cream/30 font-body">
            Built by Lightbourne. Art by MG. Code by Atlas.
          </p>
        </div>

        {/* Bottom */}
        <div className="text-center text-[10px] text-o7-cream/20 font-body">
          <p>The roots remember what the world forgot.</p>
        </div>
      </div>
    </footer>
  );
}
