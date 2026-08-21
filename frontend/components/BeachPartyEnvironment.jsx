'use client';

import { useState } from 'react';

export default function BeachPartyEnvironment({ isRecording = false, isLoading = false }) {
  const [activeCheer, setActiveCheer] = useState(null);
  const [coconutShake, setCoconutShake] = useState(false);

  const triggerCheer = (cheerText) => {
    setActiveCheer(cheerText);
    setTimeout(() => setActiveCheer(null), 2200);
  };

  const shakeTree = () => {
    setCoconutShake(true);
    triggerCheer("🌴 COCONUT DROP! 🥥");
    setTimeout(() => setCoconutShake(false), 900);
  };

  return (
    <div className="beach-env-root env-palette-2" aria-hidden="true">
      {/* ── 1. Sky & drifting clouds ── */}
      <div className="env-sky-layer">
        <div className="env-cloud cloud-1" />
        <div className="env-cloud cloud-2" />
        <div className="env-cloud cloud-3" />
      </div>

      {/* ── Sun sits on the horizon, half submerged under the ocean ── */}
      <div className="env-sun-orb" />
      <div className="env-sun-glow" />

      {/* ── 2. Distant Ocean Horizon & Rolling Waves ── */}
      <div className="env-ocean-horizon">
        <div className="env-wave wave-back" />
        <div className="env-wave wave-mid" />
        <div className="env-wave wave-front" />
      </div>

      {/* ── 3. Beach Sand Dune Base ── */}
      <div className="env-sand-dunes" />

      {/* ── 4. Interactive Left Coconut Tree with Fairy Lights & Coconuts ── */}
      <div
        className={`env-palm-cluster left-side ${coconutShake ? 'tree-shaking' : ''}`}
        onClick={shakeTree}
        title="Click Palm Tree to Shake Coconuts!"
      >
        <svg className="env-palm-svg" viewBox="-30 -80 300 520" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Detailed Textured Trunk */}
          <path d="M70 440 C85 270 110 160 155 45 C145 45 122 160 92 440 Z" fill="#3d2612" stroke="#000" strokeWidth="3.5" />
          <path d="M78 380 L106 368 M86 310 L118 298 M96 230 L130 218 M112 150 L142 138 M130 90 L152 82" stroke="#713f12" strokeWidth="3.5" strokeLinecap="round" />
          
          {/* Golden Tropical Coconuts */}
          <g className={`coconuts-group ${coconutShake ? 'coconut-bounce' : ''}`}>
            <circle cx="146" cy="48" r="13" fill="#854d0e" stroke="#000" strokeWidth="3" />
            <circle cx="142" cy="45" r="4" fill="#a16207" opacity="0.6" />
            <circle cx="164" cy="54" r="12" fill="#713f12" stroke="#000" strokeWidth="3" />
            <circle cx="152" cy="68" r="11" fill="#a16207" stroke="#000" strokeWidth="3" />
          </g>

          {/* Multi-layered Swaying Palm Fronds (10-Leaf Lush Canopy) */}
          <g className="env-palm-fronds">
            {/* Top High Canopy Fronds */}
            <path d="M155 45 Q150 -75 110 -65 Q135 -30 155 45" fill="#0d5338" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q195 -65 235 -20 Q185 15 155 45" fill="#0d5338" stroke="#000" strokeWidth="3.5" />
            
            {/* Upper Flaring Fronds */}
            <path d="M155 45 Q30 -45 -20 -10 Q40 20 155 45" fill="#106b47" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q70 -20 0 25 Q60 55 155 45" fill="#16a34a" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q125 -50 45 -25 Q95 15 155 45" fill="#22c55e" stroke="#000" strokeWidth="3.5" />
            
            {/* Right Outer & Broad Canopy Fronds */}
            <path d="M155 45 Q225 -10 255 55 Q195 50 155 45" fill="#22c55e" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q245 25 270 95 Q205 75 155 45" fill="#15803d" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q190 75 220 125 Q175 85 155 45" fill="#14532d" stroke="#000" strokeWidth="3.5" />
            
            {/* Lower Drooping Frond */}
            <path d="M155 45 Q115 85 65 130 Q120 75 155 45" fill="#16a34a" stroke="#000" strokeWidth="3.5" />

            {/* Front Highlight Sunlit Frond */}
            <path d="M155 45 Q90 5 25 40 Q85 60 155 45" fill="#86efac" stroke="#000" strokeWidth="2.5" />
          </g>
        </svg>

        {/* Sticker-Decorated Surfboard */}
        <div className="env-surfboard sb-left" onClick={(e) => { e.stopPropagation(); triggerCheer("🏄 SURF'S UP GOA!"); }}>
          <div className="sb-stripe" />
          <span className="sb-badge-tag">HHG'26</span>
        </div>
      </div>

      {/* ── 5. Interactive Right Coconut Tree ── */}
      <div
        className={`env-palm-cluster right-side ${coconutShake ? 'tree-shaking' : ''}`}
        onClick={shakeTree}
        title="Click Palm Tree to Shake Coconuts!"
      >
        <svg className="env-palm-svg flip-x" viewBox="-30 -80 300 520" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M70 440 C85 270 110 160 155 45 C145 45 122 160 92 440 Z" fill="#3d2612" stroke="#000" strokeWidth="3.5" />
          <path d="M78 380 L106 368 M86 310 L118 298 M96 230 L130 218 M112 150 L142 138 M130 90 L152 82" stroke="#713f12" strokeWidth="3.5" strokeLinecap="round" />

          {/* Golden Tropical Coconuts */}
          <g className={`coconuts-group ${coconutShake ? 'coconut-bounce' : ''}`}>
            <circle cx="146" cy="48" r="13" fill="#854d0e" stroke="#000" strokeWidth="3" />
            <circle cx="142" cy="45" r="4" fill="#a16207" opacity="0.6" />
            <circle cx="164" cy="54" r="12" fill="#713f12" stroke="#000" strokeWidth="3" />
            <circle cx="152" cy="68" r="11" fill="#a16207" stroke="#000" strokeWidth="3" />
          </g>

          {/* Multi-layered Swaying Palm Fronds (10-Leaf Lush Canopy) */}
          <g className="env-palm-fronds">
            {/* Top High Canopy Fronds */}
            <path d="M155 45 Q150 -75 110 -65 Q135 -30 155 45" fill="#0d5338" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q195 -65 235 -20 Q185 15 155 45" fill="#0d5338" stroke="#000" strokeWidth="3.5" />
            
            {/* Upper Flaring Fronds */}
            <path d="M155 45 Q30 -45 -20 -10 Q40 20 155 45" fill="#106b47" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q70 -20 0 25 Q60 55 155 45" fill="#16a34a" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q125 -50 45 -25 Q95 15 155 45" fill="#22c55e" stroke="#000" strokeWidth="3.5" />
            
            {/* Right Outer & Broad Canopy Fronds */}
            <path d="M155 45 Q225 -10 255 55 Q195 50 155 45" fill="#22c55e" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q245 25 270 95 Q205 75 155 45" fill="#15803d" stroke="#000" strokeWidth="3.5" />
            <path d="M155 45 Q190 75 220 125 Q175 85 155 45" fill="#14532d" stroke="#000" strokeWidth="3.5" />
            
            {/* Lower Drooping Frond */}
            <path d="M155 45 Q115 85 65 130 Q120 75 155 45" fill="#16a34a" stroke="#000" strokeWidth="3.5" />

            {/* Front Highlight Sunlit Frond */}
            <path d="M155 45 Q90 5 25 40 Q85 60 155 45" fill="#86efac" stroke="#000" strokeWidth="2.5" />
          </g>
        </svg>

        {/* Sticker-Decorated Surfboard */}
        <div className="env-surfboard sb-right" onClick={(e) => { e.stopPropagation(); triggerCheer("⚡ 2:47PM SOUNDS!"); }}>
          <div className="sb-stripe" />
          <span className="sb-badge-tag">RAG'26</span>
        </div>
      </div>

      {/* ── 6. Towering Concert Speakers (in front of palms) ── */}
      <div className={`env-stage-speaker speaker-left ${isRecording || isLoading ? 'pumping' : ''}`}>
        <div className="speaker-cabinet">
          <div className="speaker-tweeter" />
          <div className="speaker-woofer-ring woofer-top">
            <div className="woofer-cone" />
          </div>
          <div className="speaker-woofer-ring woofer-bot">
            <div className="woofer-cone" />
          </div>
          <div className="speaker-brand-badge">HHG-BASS</div>
        </div>
      </div>

      <div className={`env-stage-speaker speaker-right ${isRecording || isLoading ? 'pumping' : ''}`}>
        <div className="speaker-cabinet">
          <div className="speaker-tweeter" />
          <div className="speaker-woofer-ring woofer-top">
            <div className="woofer-cone" />
          </div>
          <div className="speaker-woofer-ring woofer-bot">
            <div className="woofer-cone" />
          </div>
          <div className="speaker-brand-badge">HHG-BASS</div>
        </div>
      </div>

      {/* ── Floating Cheerful Speech Bubbles ── */}
      {activeCheer && (
        <div className="env-live-cheer-bubble">
          {activeCheer}
        </div>
      )}

      {/* ── 7. Expressive Animated Festival Dancers (Flanking the Sand) ── */}
      {/* Left Sand Dancers */}
      <div className="env-side-dancers-left">
        {/* Dancer 1: Glowstick & Retro Headphone Partygirl */}
        <div
          className={`env-dancer dancer-1 ${isRecording || isLoading ? 'hyper-dancing' : ''}`}
          onClick={() => triggerCheer("🎧 DROP THE BEAT!")}
          title="Click to Cheer!"
        >
          <svg viewBox="0 0 110 170" width="130" height="205">
            {/* Legs with festival socks */}
            <path d="M40 70 L34 150 M70 70 L76 150" stroke="#f6ad55" strokeWidth="10" strokeLinecap="round" />
            <rect x="28" y="136" width="12" height="12" rx="3" fill="#ff087f" />
            <rect x="70" y="136" width="12" height="12" rx="3" fill="#ff087f" />
            {/* Neon Crop Top & Shorts */}
            <path d="M35 55 L75 55 L70 95 L40 95 Z" fill="#0d5338" stroke="#000" strokeWidth="3" />
            <rect x="36" y="86" width="38" height="18" rx="4" fill="#ffe000" stroke="#000" strokeWidth="2.5" />
            {/* Left Arm Raising Glowing Neon Stick */}
            <g className="arm-glow-left">
              <path d="M36 58 C18 42 12 24 8 12" stroke="#f6ad55" strokeWidth="9" strokeLinecap="round" />
              <line x1="4" y1="18" x2="16" y2="4" stroke="#00f0ff" strokeWidth="5" strokeLinecap="round" className="glow-stick" />
            </g>
            {/* Right Arm Waving */}
            <path d="M74 58 C90 44 94 28 98 14" stroke="#f6ad55" strokeWidth="9" strokeLinecap="round" className="arm-right" />
            {/* Head & Sunglasses */}
            <circle cx="55" cy="30" r="15" fill="#f6ad55" stroke="#000" strokeWidth="3" />
            <path d="M40 26 C40 10 70 10 70 26 C74 38 68 44 64 44 C55 44 50 44 40 26 Z" fill="#b45309" />
            {/* Neon Wayfarer Sunglasses */}
            <rect x="46" y="26" width="9" height="7" rx="2" fill="#000" stroke="#00f0ff" strokeWidth="1.5" />
            <rect x="57" y="26" width="9" height="7" rx="2" fill="#000" stroke="#00f0ff" strokeWidth="1.5" />
            {/* Over-ear DJ Headphones */}
            <path d="M38 32 C38 14 72 14 72 32" stroke="#ffe000" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="38" cy="32" r="5" fill="#ff087f" stroke="#000" strokeWidth="1.5" />
            <circle cx="72" cy="32" r="5" fill="#ff087f" stroke="#000" strokeWidth="1.5" />
          </svg>
          <span className="dancer-name-tag">ALEXA 🎧</span>
        </div>

        {/* Dancer 2: Hype Guy with Snapback Cap & Goa Shirt */}
        <div
          className={`env-dancer dancer-2 ${isRecording || isLoading ? 'hyper-dancing' : ''}`}
          onClick={() => triggerCheer("🔥 WAH GOA! SUB-200MS!")}
          title="Click to Cheer!"
        >
          <svg viewBox="0 0 110 170" width="138" height="215">
            {/* Athletic Legs */}
            <path d="M42 90 L36 152 M68 90 L74 152" stroke="#ed8936" strokeWidth="11" strokeLinecap="round" />
            <rect x="30" y="142" width="14" height="10" rx="3" fill="#ffe000" stroke="#000" strokeWidth="2" />
            <rect x="70" y="142" width="14" height="10" rx="3" fill="#ffe000" stroke="#000" strokeWidth="2" />
            {/* Boardshorts */}
            <path d="M34 82 L76 82 L72 112 L56 112 L54 94 L52 112 L36 112 Z" fill="#ffe000" stroke="#000" strokeWidth="3" />
            {/* Tropical Printed Shirt */}
            <path d="M34 50 Q55 56 76 50 L76 86 Q55 90 34 86 Z" fill="#ff087f" stroke="#000" strokeWidth="3" />
            <circle cx="48" cy="65" r="2.5" fill="#ffffff" />
            <circle cx="62" cy="72" r="2.5" fill="#ffffff" />
            {/* Hype Pump Arms */}
            <path d="M34 52 C15 62 10 44 4 32" stroke="#ed8936" strokeWidth="10" strokeLinecap="round" className="arm-left" />
            <path d="M76 52 C95 65 100 48 106 36" stroke="#ed8936" strokeWidth="10" strokeLinecap="round" className="arm-right" />
            {/* Head & Backward Snapback Cap */}
            <circle cx="55" cy="28" r="15" fill="#ed8936" stroke="#000" strokeWidth="3" />
            <path d="M40 24 C40 10 70 10 70 24 Z" fill="#0f172a" />
            <rect x="34" y="24" width="42" height="6" rx="2" fill="#0f172a" />
            <rect x="68" y="22" width="14" height="4" rx="2" fill="#ffe000" />
            {/* Cool Shades */}
            <rect x="47" y="28" width="17" height="6" rx="2" fill="#000" stroke="#fff" strokeWidth="1" />
          </svg>
          <span className="dancer-name-tag">ROHAN 🔥</span>
        </div>
      </div>

      {/* Right Sand Dancers */}
      <div className="env-side-dancers-right">
        {/* Dancer 3: Sunset Cocktail Sipper */}
        <div
          className={`env-dancer dancer-3 ${isRecording || isLoading ? 'hyper-dancing' : ''}`}
          onClick={() => triggerCheer("🍹 CHEERS TO HACKER HOUSE!")}
          title="Click to Cheer!"
        >
          <svg viewBox="0 0 110 170" width="130" height="205">
            {/* Dancing Legs */}
            <path d="M40 80 L34 150 M70 80 L76 150" stroke="#f6ad55" strokeWidth="10" strokeLinecap="round" />
            {/* Flowing Beach Dress */}
            <path d="M36 52 L74 52 L78 100 L32 100 Z" fill="#ff087f" stroke="#000" strokeWidth="3" />
            <path d="M32 100 Q55 110 78 100 L82 118 Q55 125 28 118 Z" fill="#106b47" stroke="#000" strokeWidth="2.5" />
            {/* Left Arm Flowing */}
            <path d="M36 56 C20 66 16 50 10 38" stroke="#f6ad55" strokeWidth="9" strokeLinecap="round" className="arm-left" />
            {/* Right Arm Holding Tropical Cocktail Glass with Straw */}
            <g className="arm-cocktail-right">
              <path d="M74 56 C90 48 94 36 96 24" stroke="#f6ad55" strokeWidth="9" strokeLinecap="round" />
              {/* Cocktail Glass */}
              <polygon points="90,18 104,18 97,30" fill="#38bdf8" stroke="#000" strokeWidth="1.8" />
              <line x1="97" y1="30" x2="97" y2="38" stroke="#000" strokeWidth="2.5" />
              <line x1="92" y1="38" x2="102" y2="38" stroke="#000" strokeWidth="2.5" />
              {/* Pink Umbrella & Straw */}
              <path d="M96 18 L104 8" stroke="#ff087f" strokeWidth="2" strokeLinecap="round" />
              <circle cx="103" cy="8" r="3" fill="#ffe000" />
            </g>
            {/* Head & Flower Pin */}
            <circle cx="55" cy="28" r="14" fill="#f6ad55" stroke="#000" strokeWidth="3" />
            <path d="M40 24 C40 8 70 8 70 24 Z" fill="#475569" />
            <circle cx="68" cy="20" r="4" fill="#ffe000" stroke="#000" strokeWidth="1.5" />
            {/* Sunglasses */}
            <rect x="47" y="26" width="16" height="6" rx="2" fill="#000" />
          </svg>
          <span className="dancer-name-tag">MAYA 🍹</span>
        </div>

        {/* Dancer 4: Surfer Guy with Shaka Sign */}
        <div
          className={`env-dancer dancer-4 ${isRecording || isLoading ? 'hyper-dancing' : ''}`}
          onClick={() => triggerCheer("🤙 SHAKA! FULL VIBES!")}
          title="Click to Cheer!"
        >
          <svg viewBox="0 0 110 170" width="138" height="215">
            {/* Sturdy Legs */}
            <path d="M40 90 L34 152 M70 90 L76 152" stroke="#dd6b20" strokeWidth="11" strokeLinecap="round" />
            <rect x="28" y="142" width="14" height="10" rx="3" fill="#3b82f6" stroke="#000" strokeWidth="2" />
            <rect x="70" y="142" width="14" height="10" rx="3" fill="#3b82f6" stroke="#000" strokeWidth="2" />
            {/* Boardshorts */}
            <path d="M34 82 L76 82 L72 114 L56 114 L54 94 L52 114 L36 114 Z" fill="#0d5338" stroke="#000" strokeWidth="3" />
            {/* Muscle Beach Tank */}
            <path d="M36 50 Q55 54 74 50 L74 86 Q55 90 36 86 Z" fill="#dd6b20" stroke="#000" strokeWidth="3" />
            {/* Both Arms in Air (Double Shaka Wave) */}
            <path d="M36 52 C18 32 14 16 8 6" stroke="#dd6b20" strokeWidth="10" strokeLinecap="round" className="arm-left" />
            <path d="M74 52 C92 32 96 16 102 6" stroke="#dd6b20" strokeWidth="10" strokeLinecap="round" className="arm-right" />
            {/* Head & Beach Sun Visor */}
            <circle cx="55" cy="28" r="15" fill="#dd6b20" stroke="#000" strokeWidth="3" />
            <path d="M40 22 C40 10 70 10 70 22 Z" fill="#0f172a" />
            <path d="M34 22 Q55 16 76 22 L86 20 Q55 12 24 20 Z" fill="#ffe000" stroke="#000" strokeWidth="2" />
            {/* Shades */}
            <rect x="47" y="27" width="17" height="6" rx="2" fill="#000" stroke="#ffe000" strokeWidth="1" />
          </svg>
          <span className="dancer-name-tag">KABIR 🤙</span>
        </div>
      </div>
    </div>
  );
}
