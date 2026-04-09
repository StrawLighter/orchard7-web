"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export default function SectionArrival() {
  const [scrollY, setScrollY] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(true); // Starts true because splash already started music

  useEffect(() => {
    setLoaded(true);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleMusic = useCallback(() => {
    const audio = (window as any).__o7Audio as HTMLAudioElement | undefined;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  const scale = 1 + scrollY * 0.00008;
  const translateY = scrollY * 0.3;

  return (
    <section id="arrival" className="relative h-screen w-full overflow-hidden">
      {/* Single panorama background with subtle parallax zoom */}
      <div
        className="absolute inset-0 transition-none"
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          transformOrigin: "center center",
        }}
      >
        <img
          src="/assets/arrival-panorama.png"
          alt="The Rootledge — Milo overlooks the valley"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div
          className="absolute inset-0 asset-placeholder"
          style={{ background: "linear-gradient(180deg, #1a1a3e 0%, #1B4332 40%, #2D6A4F 70%, #0d2818 100%)" }}
        >
          <span className="text-white/40">arrival-panorama.png</span>
          <span className="text-white/30 text-[10px]">1920x1080</span>
        </div>
      </div>

      {/* Dark gradient overlays for text contrast */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/50 via-transparent to-transparent" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-o7-dark via-transparent to-transparent" />
      <div className="absolute inset-0 z-[1]" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)" }} />

      {/* Content overlay */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-1000 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <div className="w-28 h-28 sm:w-36 sm:h-36 mb-6">
          <img
            src="/assets/o7-logo.png"
            alt="O7"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(181,133,27,0.3)]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div
            className="w-full h-full rounded-full border-2 border-o7-gold/40 flex items-center justify-center backdrop-blur-sm bg-o7-dark/30"
            style={{ marginTop: "-100%" }}
          >
            <span className="font-pixel text-o7-gold text-2xl drop-shadow-[0_0_10px_rgba(181,133,27,0.5)]">O7</span>
          </div>
        </div>

        <h1 className="font-pixel text-o7-cream text-sm sm:text-lg md:text-xl text-center leading-relaxed mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          ORCHARD 7
        </h1>
        <p className="text-o7-cream/80 text-sm sm:text-base italic text-center max-w-md mb-8 font-body drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          &ldquo;The roots remember what the world forgot.&rdquo;
        </p>

        <a
          href="#gardens"
          className="rpg-btn px-10 py-3 font-pixel text-xs text-o7-gold hover:text-o7-cream transition-all duration-200 hover:scale-105 active:translate-y-0.5"
        >
          Enter the Gardens
        </a>
      </div>

      {/* Music toggle */}
      <button
        onClick={toggleMusic}
        className={`absolute bottom-6 right-6 z-20 w-12 h-12 rounded-full border-2 bg-o7-dark/70 backdrop-blur-sm flex items-center justify-center transition text-lg ${playing ? "border-o7-gold text-o7-gold shadow-[0_0_12px_rgba(181,133,27,0.4)]" : "border-o7-teal/40 text-o7-teal hover:text-o7-gold hover:border-o7-gold/60"}`}
        title={playing ? "Pause music" : "Play music"}
      >
        {playing ? "\u266C" : "\u266B"}
      </button>
    </section>
  );
}
