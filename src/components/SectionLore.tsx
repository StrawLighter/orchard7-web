"use client";

export default function SectionLore() {
  const concepts = [
    { name: "Milo", file: "concept-milo.png", color: "#B5851B", desc: "The Wanderer" },
    { name: "Oru", file: "concept-oru.png", color: "#40916C", desc: "The Garden Spirit" },
    { name: "Thornhallow", file: "concept-thornhallow.png", color: "#2D6A4F", desc: "The Valley Town" },
    { name: "The Constructs", file: "concept-constructs.png", color: "#1B4332", desc: "Coming Soon" },
  ];

  return (
    <section id="lore" className="relative min-h-[70vh] bg-o7-dark py-20 px-4">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Vignette */}
        <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden border border-o7-green-mid/20">
          <img src="/assets/lore-vignette.png" alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 asset-placeholder rounded-lg" style={{ background: "linear-gradient(135deg, #1B4332, #1A1A2E)" }}>
            <span className="text-white/40">lore-vignette.png</span>
            <span className="text-white/30 text-[10px]">1200x600</span>
          </div>
        </div>

        {/* Prose */}
        <div className="text-center space-y-4">
          <h2 className="font-pixel text-o7-gold text-xs sm:text-sm drop-shadow-[0_0_8px_rgba(181,133,27,0.3)]">
            The Old World Stirs
          </h2>
          <p className="text-o7-cream/80 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-body italic">
            In the valley where gears sleep beneath moss and rivers hum with forgotten current,
            seven orchards still bear fruit. The Groves remember. The Fountain still flows.
            And somewhere beneath the roots, the old machines are waking.
          </p>
        </div>

        {/* Concept art gallery */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {concepts.map((c) => (
            <div key={c.name} className="space-y-2 group">
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-o7-green-mid/30 group-hover:border-o7-gold/40 transition-colors duration-300">
                <img src={`/assets/${c.file}`} alt={c.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  style={{ imageRendering: c.file.includes("concept-milo") || c.file.includes("concept-oru") ? "pixelated" : "auto" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="absolute inset-0 asset-placeholder" style={{ background: c.color }}>
                  <span className="text-white/40 text-[10px]">{c.file}</span>
                  <span className="text-white/30 text-[9px]">400x400</span>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-center">
                <p className="text-xs text-o7-cream/80 font-pixel" style={{ fontSize: "8px" }}>{c.name}</p>
                <p className="text-[10px] text-o7-cream/40 font-body">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
