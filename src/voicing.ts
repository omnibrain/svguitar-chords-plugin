import type { Barre, Chord, Finger } from '@svguitar/core'

/**
 * Builds the SVGuitar chord for a voicing stored as a compact string, e.g. "x32010" + "032010" + "1"
 * for an open C on a guitar:
 *
 * - one character per string for the fret, from the leftmost string (low E on a guitar) to the
 *   rightmost: "x" is a muted string, "0" an open string, other frets are relative to the base fret
 * - one character per string for the finger, "0" for no finger
 * - the base fret in base 36
 *
 * The same finger on the same fret on several strings is drawn as a barre.
 */
export function decodeVoicing(voicing: string, strings: number, title: string): Chord {
  const frets = [...voicing.slice(0, strings)].map((f) => (f === 'x' ? -1 : Number(f)))
  const fingers = [...voicing.slice(strings, 2 * strings)].map(Number)
  const baseFret = parseInt(voicing.slice(2 * strings), 36)

  // SVGuitar strings are numbered from the rightmost (1) to the leftmost
  const svgString = (index: number) => strings - index

  const held = new Map<string, number[]>()
  frets.forEach((fret, i) => {
    if (fret > 0 && fingers[i] > 0) {
      const key = `${fingers[i]}:${fret}`
      held.set(key, [...(held.get(key) ?? []), i])
    }
  })

  const coveredByBarre = new Set<number>()
  const barres: Barre[] = []
  held.forEach((indices, key) => {
    if (indices.length < 2) {
      return
    }

    const [finger, fret] = key.split(':').map(Number)
    indices.forEach((i) => coveredByBarre.add(i))
    barres.push({
      fromString: svgString(Math.min(...indices)),
      toString: svgString(Math.max(...indices)),
      fret,
      text: String(finger),
    })
  })

  const svgFingers = frets.flatMap((fret, i): Finger[] => {
    if (fret < 0) {
      return [[svgString(i), 'x']]
    }
    if (fret === 0) {
      return [[svgString(i), 0]]
    }
    if (coveredByBarre.has(i)) {
      return []
    }

    return [fingers[i] > 0 ? [svgString(i), fret, String(fingers[i])] : [svgString(i), fret]]
  })

  return {
    fingers: svgFingers,
    barres,
    title,
    ...(baseFret > 1 && { position: baseFret }),
  }
}
