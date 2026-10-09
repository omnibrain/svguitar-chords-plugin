/*
 * Finds the playable voicings of a chord on a fretted instrument and ranks them.
 *
 * Every combination of chord notes within four frets is a candidate. A voicing is scored by
 * features like the number of fingers it needs, muted strings and doubled notes; the weights of
 * these features were fitted to the chord shapes jguitar.com lists (scripts/train-voicing-weights.ts).
 *
 * This module has no runtime imports, so the training script can run it with Node directly.
 */

/** Frets from the leftmost string to the rightmost: -1 muted, 0 open, otherwise the fret. */
export type Frets = number[]

export interface ChordSpec {
  /** Pitch class of the root, 0 = C */
  root: number
  /** Pitch class of the bass note of a slash chord */
  bass: number | null
  /** Semitones above the root a voicing must contain */
  required: number[]
  /** Semitones above the root a voicing may contain */
  optional: number[]
}

export interface Instrument {
  /** MIDI note of each open string, from the leftmost string to the rightmost */
  tuning: number[]
  /** Whether the lowest note has to be the root (or the bass of a slash chord) */
  rootInBass: boolean
  /** Chords with at least this many required notes may leave out the root */
  omitRootFrom?: number
}

export interface Weights {
  features: string[]
  /** One weight per feature value (0-6), shared and then for movable, open and slash voicings */
  weights: number[]
}

const windowSize = 3
const highestPosition = 12
const minPlayedStrings = 3
const maxFingers = 4

const pitchClass = (n: number) => ((n % 12) + 12) % 12

function lowestNote(frets: Frets, tuning: number[]): number | undefined {
  let lowest: number | undefined
  frets.forEach((fret, i) => {
    if (fret >= 0 && (lowest === undefined || tuning[i] + fret < lowest)) {
      lowest = tuning[i] + fret
    }
  })

  return lowest
}

/**
 * All voicings of a chord in open position (frets 0-3) and in every four-fret window up to the
 * 12th fret. A shape higher up the neck is the same as one 12 frets lower, so it isn't repeated.
 */
export function candidates(
  chord: ChordSpec,
  { tuning, rootInBass, omitRootFrom = Infinity }: Instrument,
): Frets[] {
  const chordNotes = new Set(
    [...chord.required, ...chord.optional].map((i) => pitchClass(chord.root + i)),
  )
  const allowed = new Set(chordNotes)
  if (chord.bass !== null) {
    allowed.add(chord.bass)
  }
  const needed = chord.required
    .filter((i) => i !== 0 || chord.required.length < omitRootFrom)
    .map((i) => pitchClass(chord.root + i))
  const bassIsChordNote = chord.bass === null || chordNotes.has(chord.bass)
  const bass = chord.bass ?? (rootInBass ? chord.root : null)

  const found = new Map<string, Frets>()
  for (let position = 0; position <= highestPosition; position++) {
    const open = position === 0
    const options = tuning.map((string) => {
      const frets = [-1]
      for (
        let fret = open ? 0 : position;
        fret <= (open ? windowSize : position + windowSize);
        fret++
      ) {
        if (allowed.has(pitchClass(string + fret))) {
          frets.push(fret)
        }
      }
      return frets
    })

    const frets: Frets = tuning.map(() => -1)
    const visit = (string: number) => {
      if (string < tuning.length) {
        options[string].forEach((fret) => {
          frets[string] = fret
          visit(string + 1)
        })
        frets[string] = -1
        return
      }

      // each shape once: open voicings have an open string, the others start at the window
      if (open ? !frets.includes(0) : !frets.includes(position)) return
      if (frets.filter((f) => f >= 0).length < minPlayedStrings) return

      const notes = frets.flatMap((fret, i) => (fret >= 0 ? [pitchClass(tuning[i] + fret)] : []))
      if (!needed.every((note) => notes.includes(note))) return
      const lowest = lowestNote(frets, tuning)
      if (bass !== null && (lowest === undefined || pitchClass(lowest) !== bass)) return
      // a bass note that isn't part of the chord is only played once
      if (!bassIsChordNote && notes.filter((note) => note === chord.bass).length > 1) return

      found.set(frets.join(), [...frets])
    }
    visit(0)
  }

  return [...found.values()]
}

/**
 * The number of fingers a voicing needs. Notes on the same fret can share a finger as a barre if
 * nothing between them is open or lower, either on the lowest fret (`lowestOnly`) or, otherwise,
 * also on adjacent strings higher up.
 */
export function fingersNeeded(frets: Frets, lowestOnly: boolean): number {
  const fretted = frets.flatMap((fret, i) => (fret > 0 ? [i] : []))
  if (fretted.length === 0) return 0
  const lowest = Math.min(...fretted.map((i) => frets[i]))

  let fingers = 0
  new Set(fretted.map((i) => frets[i])).forEach((fret) => {
    const strings = fretted.filter((i) => frets[i] === fret)
    const segments: number[][] = [[strings[0]]]
    for (let k = 1; k < strings.length; k++) {
      const between = frets.slice(strings[k - 1] + 1, strings[k])
      if (between.some((f) => f >= 0 && f < fret)) {
        segments.push([strings[k]])
      } else {
        segments[segments.length - 1].push(strings[k])
      }
    }
    segments.forEach((segment) => {
      const adjacent = segment.every((s, k) => k === 0 || s === segment[k - 1] + 1)
      fingers += fret === lowest || (!lowestOnly && adjacent) ? 1 : segment.length
    })
  })

  return fingers
}

/**
 * Which finger plays each string (0 for none): one finger per note in order of fret and string. If
 * that takes more than four fingers, the index finger barres the lowest fret, and if that still
 * isn't enough, other fingers barre adjacent strings of the same fret.
 */
export function assignFingers(frets: Frets): number[] {
  const notes = frets
    .flatMap((fret, i) => (fret > 0 ? [{ fret, string: i }] : []))
    .sort((a, b) => a.fret - b.fret || a.string - b.string)
  const lowest = notes[0]?.fret

  const group = (barreAdjacent: boolean) => {
    const groups: number[][] = []
    notes.forEach(({ fret, string }) => {
      const last = groups[groups.length - 1]
      const previous = last?.[last.length - 1]
      const between = previous === undefined ? [] : frets.slice(previous + 1, string)
      const canShare =
        previous !== undefined &&
        frets[previous] === fret &&
        !between.some((f) => f >= 0 && f < fret) &&
        (fret === lowest || (barreAdjacent && string === previous + 1))
      if (canShare) {
        last.push(string)
      } else {
        groups.push([string])
      }
    })
    return groups
  }

  const groups =
    notes.length <= maxFingers
      ? notes.map(({ string }) => [string])
      : group(false).length <= maxFingers
        ? group(false)
        : group(true)
  const fingers = frets.map(() => 0)
  groups.forEach((strings, k) =>
    strings.forEach((string) => (fingers[string] = Math.min(k + 1, maxFingers))),
  )

  return fingers
}

function features(frets: Frets, all: Frets[], chord: ChordSpec, tuning: number[]) {
  const played = frets.map((f) => f >= 0)
  const first = played.indexOf(true)
  const last = played.lastIndexOf(true)
  const fretted = frets.filter((f) => f > 0)
  const lowest = fretted.length ? Math.min(...fretted) : 0
  const intervals = frets.map((f, i) => (f < 0 ? null : pitchClass(tuning[i] + f - chord.root)))
  const counts = new Map<number, number>()
  intervals.forEach((i) => i !== null && counts.set(i, (counts.get(i) ?? 0) + 1))
  let stretch = 0
  fretted.forEach((a) => fretted.forEach((b) => (stretch = Math.max(stretch, a - b))))

  // a voicing is "dominated" if playing more strings needs no more fingers
  const fingersLowest = fingersNeeded(frets, true)
  const fingersAdjacent = fingersNeeded(frets, false)
  let dominatedLowest = 0
  let dominatedAdjacent = 0
  let supersets = 0
  all.forEach((other) => {
    if (other === frets) return
    const isSuperset =
      frets.every((f, i) => f < 0 || other[i] === f) && other.some((f, i) => f >= 0 && frets[i] < 0)
    if (!isSuperset) return
    supersets++
    if (fingersNeeded(other, true) <= fingersLowest) dominatedLowest = 1
    const otherAdjacent = fingersNeeded(other, false)
    if (otherAdjacent <= fingersAdjacent && otherAdjacent <= maxFingers) dominatedAdjacent = 1
  })

  const chordNotes = [...chord.required, ...chord.optional]
  const bass = chord.bass ?? chord.root
  const bassInterval = pitchClass(bass - chord.root)

  return {
    played: played.filter(Boolean).length,
    interior: played.slice(first, last + 1).filter((p) => !p).length,
    bassString: first,
    topMuted: frets.length - 1 - last,
    fingers: fingersNeeded(frets, false),
    span: stretch,
    doubles: [...counts.values()].reduce((sum, c) => sum + c - 1, 0),
    optMissing: chord.optional.filter((i) => !counts.has(i)).length,
    rootDoubled: (counts.get(0) ?? 0) > 1 ? 1 : 0,
    topIsRoot: intervals[last] === 0 ? 1 : 0,
    atMin: fretted.filter((f) => f === lowest).length,
    open: frets.filter((f) => f === 0).length,
    fB: fingersLowest,
    fC: fingersAdjacent,
    domB: dominatedLowest,
    domC: dominatedAdjacent,
    supers: supersets,
    formula: chordNotes.length,
    slash: chord.bass === null ? 0 : chordNotes.includes(bassInterval) ? 1 : 2,
    bassCount: counts.get(bassInterval) ?? 0,
  }
}

export type Features = ReturnType<typeof features>

const groupOf = (frets: Frets, chord: ChordSpec) =>
  chord.bass !== null ? 2 : frets.includes(0) ? 1 : 0

/**
 * The indices of the weights a voicing's features select: each feature value (capped at 6) has a
 * weight shared by all voicings and one for its group (movable, open or slash).
 */
export function featureIndices(
  f: Features,
  frets: Frets,
  chord: ChordSpec,
  names: string[],
): number[] {
  const block = 1 + names.length * 7
  const shared = [
    0,
    ...names.map((name, k) => 1 + k * 7 + Math.max(0, Math.min(6, f[name as keyof Features]))),
  ]
  const offset = block * (1 + groupOf(frets, chord))

  return [...shared, ...shared.map((i) => i + offset)]
}

/**
 * The playable voicings of a chord with their features, i.e. the candidates that need at most
 * four fingers.
 */
export function playableVoicings(chord: ChordSpec, instrument: Instrument) {
  const all = candidates(chord, instrument)

  return all
    .filter((frets) => fingersNeeded(frets, false) <= maxFingers)
    .map((frets) => ({ frets, features: features(frets, all, chord, instrument.tuning) }))
}

/**
 * The voicings of a chord that score above 0, best first. If none does, the best three.
 */
export function rankedVoicings(
  chord: ChordSpec,
  instrument: Instrument,
  { features: names, weights }: Weights,
): Frets[] {
  const scored = playableVoicings(chord, instrument)
    .map(({ frets, features: f }) => ({
      frets,
      score: featureIndices(f, frets, chord, names).reduce((sum, i) => sum + weights[i], 0),
    }))
    .sort((a, b) => b.score - a.score)

  const good = scored.filter(({ score }) => score > 0)

  return (good.length ? good : scored.slice(0, 3)).map(({ frets }) => frets)
}
