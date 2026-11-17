import { spring } from 'motion'

/**
 * The page's spring, as something a browser animation can run. Motion is asked
 * only for the curve: its spring, sampled into a `linear()` easing, so the engine
 * animates it rather than a frame loop of ours.
 *
 * `bounce: 0` is critically damped — it arrives without overshooting — and
 * `visualDuration` is when it looks arrived, in seconds. `duration` is when it
 * has settled, in ms, a little later.
 *
 * It runs at build time: the components that spring (`ui/Disclosure`,
 * `ui/ShowMore`) work the curve out and hand it to their scripts on an element,
 * so the solver never ships. Import it from a component, not a script.
 */
export function springCurve(visualDuration: number) {
  const curve = spring({ keyframes: [0, 1], bounce: 0, visualDuration }).toString()
  return { duration: Number.parseFloat(curve), easing: curve.replace(/^[\d.]+ms /, '') }
}
