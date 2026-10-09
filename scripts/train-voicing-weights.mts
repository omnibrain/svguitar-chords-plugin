/*
 * Fits the weights the voicing generator ranks voicings with, so that it picks the shapes
 * jguitar.com lists. The jguitar chords come from https://github.com/T-vK/chord-collection, which is
 * downloaded for training only and not part of this package.
 *
 * Run with: node scripts/train-voicing-weights.mts
 */
import { writeFileSync } from 'node:fs'
import { chordFormulas } from '../src/chord-formulas.ts'
import {
  featureIndices,
  playableVoicings,
  type ChordSpec,
  type Frets,
  type Instrument,
} from '../src/voicing-generator.ts'

const source = 'https://raw.githubusercontent.com/T-vK/chord-collection/master/chords.complete.json'
const guitar: Instrument = { tuning: [40, 45, 50, 55, 59, 64], rootInBass: true }
const pitchClasses: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
}
const typeNames: Record<string, string> = {
  '': 'major',
  m: 'minor',
  '6add9': '69',
  m6add9: 'm69',
  augmaj7: 'maj7#5',
}

interface Sample {
  type: string
  group: number
  x: number[]
  y: number
}

const shape = (frets: Frets) => {
  const lowest = Math.min(...frets.filter((f) => f > 0))
  return frets.map((f) => (f < 0 ? 'x' : f - lowest)).join()
}

async function samples(): Promise<{ samples: Sample[]; names: string[] }> {
  const chords: Record<string, { positions: string[] }[]> = await (await fetch(source)).json()
  const result: Sample[] = []
  let names: string[] = []

  for (const [name, voicings] of Object.entries(chords)) {
    // the chords are listed with sharps and again with flats
    const match = /^([A-G]#?)(.*?)(?:\/([A-G]#?))?$/.exec(name)
    if (!match || /^b/.test(match[2])) continue
    const type = typeNames[match[2]] ?? match[2]
    const formula = chordFormulas[type]
    const root = pitchClasses[match[1]]
    const bass = match[3] === undefined ? null : pitchClasses[match[3]]
    // slash chords of two roots are enough to learn from, there are many
    if (!formula || (bass !== null && root !== 0 && root !== 7)) continue

    const listed = voicings.map(({ positions }) =>
      positions.map((p) => (p === 'x' ? -1 : Number(p))),
    )
    const exact = new Set(listed.map((frets) => frets.join()))
    const shapes = new Set(listed.filter((frets) => !frets.includes(0)).map(shape))
    const chord: ChordSpec = { root, bass, required: formula[0], optional: formula[1] }

    playableVoicings(chord, guitar).forEach(({ frets, features }) => {
      names = Object.keys(features)
      const open = frets.includes(0)
      result.push({
        type,
        group: bass !== null ? 2 : open ? 1 : 0,
        x: featureIndices(features, frets, chord, names),
        y: (open ? exact.has(frets.join()) : shapes.has(shape(frets))) ? 1 : 0,
      })
    })
  }

  return { samples: result, names }
}

// logistic regression
function fit(train: Sample[], size: number): number[] {
  const w = new Float64Array(size)
  for (let epoch = 0; epoch < 300; epoch++) {
    const gradient = new Float64Array(size)
    train.forEach(({ x, y }) => {
      const p = 1 / (1 + Math.exp(-x.reduce((sum, i) => sum + w[i], 0)))
      x.forEach((i) => (gradient[i] += p - y))
    })
    for (let i = 0; i < size; i++) w[i] -= gradient[i] / train.length + 0.0005 * w[i]
  }
  return [...w]
}

function report(w: number[], set: Sample[], label: string) {
  ;['movable', 'open', 'slash'].forEach((group, g) => {
    let tp = 0
    let fp = 0
    let fn = 0
    set
      .filter((s) => s.group === g)
      .forEach(({ x, y }) => {
        const predicted = x.reduce((sum, i) => sum + w[i], 0) > 0
        if (predicted && y) tp++
        else if (predicted) fp++
        else if (y) fn++
      })
    console.log(
      `${label} ${group.padEnd(7)} precision ${((100 * tp) / (tp + fp)).toFixed(1)}%  recall ${((100 * tp) / (tp + fn)).toFixed(1)}%  F1 ${((200 * tp) / (2 * tp + fp + fn)).toFixed(1)}%`,
    )
  })
}

const { samples: all, names } = await samples()
const size = (1 + names.length * 7) * 4
const types = [...new Set(all.map((s) => s.type))].sort()
const half = (s: Sample, even: boolean) => types.indexOf(s.type) % 2 === (even ? 0 : 1)

console.log(`${all.length} voicings of ${types.length} chord types`)
// fitted on half the chord types, tested on the other half
report(
  fit(
    all.filter((s) => half(s, true)),
    size,
  ),
  all.filter((s) => half(s, false)),
  'held out',
)
const weights = fit(all, size)
report(weights, all, 'all     ')

writeFileSync(
  new URL('../src/data/voicing-weights.json', import.meta.url),
  JSON.stringify({ features: names, weights: weights.map((w) => Math.round(w * 1000) / 1000) }) +
    '\n',
)
