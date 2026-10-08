// Generates src/data/<instrument>.json from @tombatossals/chords-db.
//
// Chord types the database has for some roots but not others are filled in by moving shapes
// without open strings up or down the neck. Voicings are stored as compact strings, see
// src/voicing.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const pitchClass = (note) =>
  (({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[note[0]] +
    [...note.slice(1)].reduce((sum, a) => sum + (a === '#' ? 1 : -1), 12)) %
  12
const maxVoicings = 4
const maxBaseFret = 12

// Slash chords are compared by the interval of the bass note, e.g. C/E and D/F# are both "/+4".
function chordType(root, suffix) {
  const slash = /^(m?\/)(.+)$/.exec(suffix)

  return slash ? `${slash[1]}+${(pitchClass(slash[2]) - root + 12) % 12}` : suffix
}

function suffixName(root, type) {
  const slash = /^(m?\/)\+(\d+)$/.exec(type)

  return slash ? slash[1] + notes[(root + Number(slash[2])) % 12] : type
}

// Some slash chords in the database have the wrong bass note, e.g. one "Am/G#" is really Am/F#
function hasBass(root, type, { frets, baseFret }, tuning) {
  const slash = /^m?\/\+(\d+)$/.exec(type)
  if (!slash) return true

  const lowest = frets.findIndex((fret) => fret >= 0)
  const fret = frets[lowest] === 0 ? 0 : baseFret + frets[lowest] - 1

  return (pitchClass(tuning[lowest]) + fret) % 12 === (root + Number(slash[1])) % 12
}

function encode({ frets, fingers, baseFret }) {
  return frets.map((f) => (f < 0 ? 'x' : f)).join('') + fingers.join('') + baseFret.toString(36)
}

for (const instrument of ['guitar', 'ukulele']) {
  const db = JSON.parse(
    readFileSync(require.resolve(`@tombatossals/chords-db/lib/${instrument}.json`), 'utf8'),
  )

  const tuning = db.tunings.standard.map((note) => note.replace(/\d/, ''))

  // root pitch class -> chord type -> voicings
  const byRoot = new Map()
  const types = new Set()
  let removed = 0
  for (const variants of Object.values(db.chords)) {
    for (const { key, suffix, positions } of variants) {
      const root = pitchClass(key)
      const type = chordType(root, suffix)
      if (!byRoot.has(root)) byRoot.set(root, { key, types: new Map() })
      const voicings = positions.filter((voicing) => hasBass(root, type, voicing, tuning))
      removed += positions.length - voicings.length
      if (voicings.length > 0) {
        byRoot.get(root).types.set(type, { suffix, voicings })
        types.add(type)
      }
    }
  }

  let added = 0
  for (const type of types) {
    const movable = [...byRoot].flatMap(([root, { types }]) =>
      (types.get(type)?.voicings ?? [])
        .filter(({ frets }) => !frets.includes(0))
        .map((voicing) => ({ root, voicing })),
    )

    for (const [root, { types }] of byRoot) {
      if (types.has(type) || movable.length === 0) continue

      const voicings = new Map()
      movable.forEach(({ root: from, voicing }) => {
        const shift = (root - from + 12) % 12
        const baseFret = [voicing.baseFret + shift, voicing.baseFret + shift - 12].find(
          (fret) => fret >= 1 && fret <= maxBaseFret,
        )
        if (baseFret !== undefined) {
          const transposed = { ...voicing, baseFret }
          voicings.set(encode(transposed), transposed)
        }
      })

      const sorted = [...voicings.values()]
        .sort((a, b) => a.baseFret - b.baseFret)
        .slice(0, maxVoicings)
      if (sorted.length > 0) {
        types.set(type, { suffix: suffixName(root, type), voicings: sorted })
        added += 1
      }
    }
  }

  const chords = {}
  for (const [, { key, types }] of [...byRoot].sort(([a], [b]) => a - b)) {
    chords[key] = {}
    for (const { suffix, voicings } of types.values()) {
      chords[key][suffix] = voicings.map(encode).join(' ')
    }
  }

  writeFileSync(
    new URL(`../src/data/${instrument}.json`, import.meta.url),
    JSON.stringify(chords) + '\n',
  )
  console.log(
    `${instrument}: removed ${removed} voicings with the wrong bass note, added ${added} chords by transposing`,
  )
}
