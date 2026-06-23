"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * KenBurnsPreview
 * ---------------
 * Zero-cost, client-side "camera motion" teaser over a still photo. Maps the
 * selected scene preset to a subtle Ken Burns move (push-in, pan, tilt, orbit,
 * pull-back…) and loops it with Framer Motion — so a 0-credit user sees their
 * own photo "move" before paying for a real AI render. Pure CSS transforms,
 * no fal cost.
 *
 * The image is rendered object-cover inside an overflow-hidden box; every motion
 * keeps a base scale > 1 so translating never reveals the container edges.
 */

type Move = {
  scale: [number, number];
  x: [string, string];
  y: [string, string];
  rotate: [number, number];
  duration: number;
};

const PUSH_IN: Move = { scale: [1.0, 1.14], x: ["0%", "0%"], y: ["0%", "0%"], rotate: [0, 0], duration: 9 };
const PULL_BACK: Move = { scale: [1.16, 1.0], x: ["0%", "0%"], y: ["0%", "0%"], rotate: [0, 0], duration: 9 };
const PAN_LEFT: Move = { scale: [1.14, 1.14], x: ["3%", "-3%"], y: ["0%", "0%"], rotate: [0, 0], duration: 10 };
const TILT_UP: Move = { scale: [1.14, 1.14], x: ["0%", "0%"], y: ["3%", "-3%"], rotate: [0, 0], duration: 10 };
const ORBIT: Move = { scale: [1.1, 1.16], x: ["-2%", "2%"], y: ["0%", "0%"], rotate: [-0.6, 0.6], duration: 11 };
const BREATHE: Move = { scale: [1.02, 1.08], x: ["0%", "0%"], y: ["0%", "0%"], rotate: [0, 0], duration: 8 };

/** Maps a scene preset id to a camera-motion hint for the preview. */
function moveForPreset(presetId: string | null | undefined): Move {
  switch (presetId) {
    case "push_in_serene":
    case "golden_hour_drift":
    case "handheld_walk_through":
    case "whip_to_detail":
      return PUSH_IN;
    case "depth_reveal":
    case "drone_pull_away":
      return PULL_BACK;
    case "parallax_architectural":
      return PAN_LEFT;
    case "tilt_vertical":
    case "boom_up_reveal":
    case "vertical_pan_over_facade":
      return TILT_UP;
    case "orbit_subtle":
      return ORBIT;
    case "rack_focus":
    case "micro_zoom_breathing":
      return BREATHE;
    default:
      return PUSH_IN;
  }
}

export function KenBurnsPreview({
  src,
  presetId,
  alt = "Pré-visualização de movimento",
  className = "",
}: {
  src: string | null | undefined;
  presetId: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const move = moveForPreset(presetId);

  if (!src) {
    return <div className={`bg-white/5 ${className}`} aria-hidden />;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
        initial={false}
        animate={
          reduce
            ? { scale: 1.06 }
            : {
                scale: move.scale,
                x: move.x,
                y: move.y,
                rotate: move.rotate,
              }
        }
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: move.duration,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
              }
        }
      />
    </div>
  );
}
