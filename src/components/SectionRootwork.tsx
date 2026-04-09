"use client";

import { useState } from "react";

export default function SectionRootwork() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="rootwork" className="relative min-h-[70vh] py-20 px-4" style={{ background: "linear-gradient(180deg, #1A1A2E 0%, #0d0d1a 50%, #1A1A2E 100%)" }}>
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Dungeon entrance */}
        <div className="relative w-full h-64 sm:h-96 rounded-lg overflow-hidden border-2 border-o7-green-mid/20">
          <img src="/assets/dungeon-entrance.png" alt="The Rootwork" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 asset-placeholder rounded-lg" style={{ background: "linear-gradient(180deg, #0d0d1a, #1a0d0d)" }}>
            <span className="text-white/40">dungeon-entrance.png</span>
            <span className="text-white/30 text-[10px]">1200x600</span>
          </div>
          {/* Dark vignette overlay */}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
          {/* Coming Soon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-pixel text-o7-gold text-sm sm:text-base animate-gentle-pulse drop-shadow-[0_0_15px_rgba(181,133,27,0.4)]">
              Coming Soon
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="text-center space-y-4">
          <h2 className="font-pixel text-o7-cream/80 text-xs sm:text-sm">The Rootwork</h2>
          <p className="text-o7-cream/50 text-sm leading-relaxed max-w-xl mx-auto font-body italic">
            Beneath the orchards, the old passages wait. The Rootwork holds treasures
            for those brave enough to descend.
          </p>
        </div>

        {/* Silhouette */}
        <div className="relative w-full max-w-md mx-auto h-40 rounded-lg overflow-hidden border border-o7-green-mid/10">
          <img src="/assets/dungeon-silhouette.png" alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 asset-placeholder rounded-lg" style={{ background: "#0d0d1a" }}>
            <span className="text-white/30">dungeon-silhouette.png</span>
            <span className="text-white/20 text-[10px]">800x400</span>
          </div>
        </div>

        {/* Signup */}
        <div className="max-w-md mx-auto space-y-3">
          <p className="text-center text-xs text-o7-cream/30 font-body">Get notified when the Rootwork opens</p>
          {submitted ? (
            <div className="rpg-panel rounded-lg p-4 text-center">
              <p className="text-sm text-o7-teal font-body">Noted. The roots will call you.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="email" placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rpg-input flex-1" />
              <button onClick={() => { if (email) setSubmitted(true); }}
                className="rpg-btn px-4 py-2 font-pixel text-[9px] text-o7-gold">
                Notify Me
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
