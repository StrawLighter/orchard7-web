"use client";

import { useState } from "react";

export default function SectionRootwork() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="rootwork" className="relative min-h-[70vh] py-20 px-4" style={{ background: "linear-gradient(180deg, #1A1A2E 0%, #0d0d1a 50%, #1A1A2E 100%)" }}>
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Dungeon entrance */}
        <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden">
          <img src="/assets/dungeon-entrance.png" alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 asset-placeholder rounded-lg" style={{ background: "linear-gradient(180deg, #0d0d1a, #1a0d0d)" }}>
            <span className="text-white/40">dungeon-entrance.png</span>
            <span className="text-white/30 text-[10px]">1200x600</span>
          </div>
          {/* Coming Soon overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="font-pixel text-o7-gold text-sm animate-gentle-pulse">Coming Soon</span>
          </div>
        </div>

        {/* Description */}
        <div className="text-center space-y-4">
          <h2 className="font-pixel text-o7-cream/80 text-xs sm:text-sm">The Rootwork</h2>
          <p className="text-o7-cream/60 text-sm leading-relaxed max-w-xl mx-auto font-body italic">
            Beneath the orchards, the old passages wait. The Rootwork holds treasures
            for those brave enough to descend.
          </p>
        </div>

        {/* Silhouette */}
        <div className="relative w-full max-w-md mx-auto h-40 rounded-lg overflow-hidden">
          <img src="/assets/dungeon-silhouette.png" alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 asset-placeholder rounded-lg" style={{ background: "#0d0d1a" }}>
            <span className="text-white/30">dungeon-silhouette.png</span>
            <span className="text-white/20 text-[10px]">800x400</span>
          </div>
        </div>

        {/* Signup */}
        <div className="max-w-md mx-auto space-y-3">
          <p className="text-center text-xs text-o7-cream/40 font-body">Get notified when the Rootwork opens</p>
          {submitted ? (
            <p className="text-center text-sm text-o7-teal font-body">Noted. The roots will call you.</p>
          ) : (
            <div className="flex gap-2">
              <input type="email" placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-md border border-o7-teal/20 bg-o7-dark/60 px-3 py-2 text-o7-cream text-sm font-body" />
              <button onClick={() => { if (email) setSubmitted(true); }}
                className="rpg-panel rounded-md px-4 py-2 font-pixel text-[10px] text-o7-gold hover:text-o7-cream transition">
                Notify Me
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
