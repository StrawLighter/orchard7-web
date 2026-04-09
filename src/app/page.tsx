"use client";

import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import SectionArrival from "@/components/SectionArrival";
import SectionLore from "@/components/SectionLore";
import SectionGardens from "@/components/SectionGardens";
import SectionRootwork from "@/components/SectionRootwork";
import SectionCommunity from "@/components/SectionCommunity";

export default function Home() {
  const [entered, setEntered] = useState(false);

  return (
    <>
      {!entered && <SplashScreen onEnter={() => setEntered(true)} />}
      <div className={entered ? "opacity-100" : "opacity-0 pointer-events-none"} style={{ transition: "opacity 0.5s ease 0.3s" }}>
        <SectionArrival />
        <SectionLore />
        <SectionGardens />
        <SectionRootwork />
        <SectionCommunity />
      </div>
    </>
  );
}
