"use client";

import { useEffect, useState } from "react";

export default function SectionArrival() {
  const [scrollY, setScrollY] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="arrival" className="relative h-screen w-full overflow-hidden">
      {/* 4-layer parallax */}
      <ParallaxLayer src="/assets/arrival-sky.png" speed={0.1} scrollY={scrollY}
        fallbackColor="#1a1a3e" label="arrival-sky.png" dims="1920x1080" />
      <ParallaxLayer src="/assets/arrival-mountains.png" speed={0.25} scrollY={scrollY}
        fallbackColor="#1B4332" label="arrival-mountains.png" dims="1920x1080" />
      <ParallaxLayer src="/assets/arrival-valley.png" speed={0.45} scrollY={scrollY}
        fallbackColor="#2D6A4F" label="arrival-valley.png" dims="1920x1080" />
      <ParallaxLayer src="/assets/arrival-foreground.png" speed={0.65} scrollY={scrollY}
        fallbackColor="#0d2818" label="arrival-foreground.png" dims="1920x1080" />

      {/* Content overlay */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-1000 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {/* Logo */}
        <div className="w-32 h-32 mb-6">
          <img src="/assets/o7-logo.png" alt="O7" className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="w-full h-full rounded-full border-2 border-o7-gold/40 flex items-center justify-center"
            style={{ marginTop: "-100%" }}>
            <span className="font-pixel text-o7-gold text-2xl">O7</span>
          </div>
        </div>

        <h1 className="font-pixel text-o7-cream text-sm sm:text-lg md:text-xl text-center leading-relaxed mb-4">
          ORCHARD 7
        </h1>
        <p className="text-o7-cream/70 text-sm sm:text-base italic text-center max-w-md mb-8 font-body">
          &ldquo;The roots remember what the world forgot.&rdquo;
        </p>

        <a href="#gardens"
          className="rpg-panel px-8 py-3 font-pixel text-xs text-o7-gold hover:text-o7-cream transition cursor-pointer">
          Enter the Gardens
        </a>
      </div>

      {/* Music toggle (UI only) */}
      <button className="absolute bottom-6 right-6 z-20 w-10 h-10 rounded-full border border-o7-teal/30 bg-o7-dark/60 flex items-center justify-center text-o7-teal/50 hover:text-o7-teal transition text-sm"
        title="Music (coming soon)">
        &#9835;
      </button>

      {/* Gradient fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-o7-dark to-transparent z-10" />
    </section>
  );
}

function ParallaxLayer({ src, speed, scrollY, fallbackColor, label, dims }: {
  src: string; speed: number; scrollY: number; fallbackColor: string; label: string; dims: string;
}) {
  return (
    <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * speed}px)` }}>
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div className="absolute inset-0 asset-placeholder" style={{ background: fallbackColor }}>
        <span className="text-white/40">{label}</span>
        <span className="text-white/30 text-[10px]">{dims}</span>
      </div>
    </div>
  );
}
