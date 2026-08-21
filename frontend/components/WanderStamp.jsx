'use client';

import { useState } from 'react';

const SPOTS = [
  { left: '56%', top: '46%', rotate: '-8deg' },
  { left: '12%', top: '14%', rotate: '7deg' },
  { left: '90%', top: '18%', rotate: '-14deg' },
  { left: '16%', top: '88%', rotate: '11deg' },
  { left: '86%', top: '82%', rotate: '-3deg' },
];

/** Official HHG गोवा stamp over the title — hops spots on click like hhg-task.vercel.app. */
export default function WanderStamp() {
  const [index, setIndex] = useState(0);
  const spot = SPOTS[index];

  return (
    <button
      type="button"
      aria-label="Stamp the next spot"
      className="wander-stamp-btn"
      onClick={() => setIndex((i) => (i + 1) % SPOTS.length)}
      style={{
        left: spot.left,
        top: spot.top,
        transform: `translate(-50%, -50%) rotate(${spot.rotate})`,
      }}
    >
      <img
        className="wander-stamp-img"
        src="/brand/goa_hindi.svg"
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        draggable={false}
      />
    </button>
  );
}
