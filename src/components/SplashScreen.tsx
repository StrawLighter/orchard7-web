"use client";

import { useState, useRef } from "react";

export default function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const [fading, setFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleEnter = () => {
    // Start music
    const audio = document.createElement("audio");
    audio.src = "/assets/o7-theme.mp3";
    audio.loop = true;
    audio.volume = 0.4;
    audio.play().catch(() => {});
    audioRef.current = audio;

    // Store audio ref globally so the main site can access it
    (window as any).__o7Audio = audio;

    // Fade out splash
    setFading(true);
    setTimeout(() => onEnter(), 800);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-700 ${fading ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      {/* Background */}
      <img
        src="/assets/splash-sky.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center bottom, transparent 30%, rgba(0,0,0,0.5) 100%)" }} />

      {/* Content */}
      <div className={`relative z-10 flex flex-col items-center gap-8 transition-all duration-1000 ${fading ? "scale-110 opacity-0" : "scale-100 opacity-100"}`}>
        {/* Logo */}
        <div className="w-24 h-24 sm:w-32 sm:h-32">
          <img src="/assets/o7-crest.png" alt="O7" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(181,133,27,0.4)]" />
        </div>

        <h1 className="font-pixel text-o7-cream/90 text-xs sm:text-sm text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          ORCHARD 7
        </h1>

        <button
          onClick={handleEnter}
          className="rpg-btn px-10 py-4 font-pixel text-[10px] sm:text-xs text-o7-gold hover:text-o7-cream transition-all duration-200 hover:scale-105 active:translate-y-0.5 animate-gentle-pulse"
        >
          Enter Orchard 7
        </button>

        <p className="text-o7-cream/30 text-[10px] font-body italic">
          Best with sound on
        </p>
      </div>
    </div>
  );
}
