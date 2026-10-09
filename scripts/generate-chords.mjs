// Generates src/data/<instrument>.json from @tombatossals/chords-db.
//
// Voicings with the wrong notes are fixed or left out. Chord types the database has for some roots
// but not others are filled in by moving shapes without open strings up or down the neck. Voicings
// are stored as compact strings, see src/voicing.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { chordFormulas } from '../src/chord-formulas.ts'

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

const midi = (note) => pitchClass(note.replace(/\d/, '')) + 12 * (Number(note.at(-1)) + 1)

/**
 * Checks a voicing's notes against its chord type. A barre that also covers the lowest strings
 * (shown in gray on the chords-db website) is taken off the strings that would put the wrong note in
 * the bass. Returns the voicing, or undefined if its notes don't match the chord.
 */
function checkVoicing(root, type, voicing, { tuning, rootInBass }) {
  const slash = /^(m?)\/\+(\d+)$/.exec(type)
  const formula = chordFormulas[slash ? (slash[1] ? 'minor' : 'major') : type]
  if (!formula) return voicing

  const [required, optional] = formula
  const bass = slash ? Number(slash[2]) : 0
  const frets = [...voicing.frets]
  const fingers = [...voicing.fingers]
  const interval = (i) => (tuning[i] + (frets[i] === 0 ? 0 : voicing.baseFret + frets[i] - 1) - root + 120) % 12
  const pitch = (i) => tuning[i] + (frets[i] === 0 ? 0 : voicing.baseFret + frets[i] - 1)
  const lowestString = () =>
    frets.reduce((low, f, i) => (f >= 0 && (low < 0 || pitch(i) < pitch(low)) ? i : low), -1)

  if (rootInBass) {
    for (let s = lowestString(); s >= 0 && interval(s) !== bass; s = lowestString()) {
      const barred = frets.some((f, i) => i !== s && f === frets[s] && fingers[i] === fingers[s] && fingers[s] > 0)
      if (!barred) break
      frets[s] = -1
      fingers[s] = 0
    }
  }

  const played = frets.flatMap((f, i) => (f >= 0 ? [interval(i)] : []))
  const allowed = [...required, ...optional, bass]
  const needed = required.filter((i) => i !== 0 || rootInBass || required.length < 4)
  const ok =
    played.every((i) => allowed.includes(i)) &&
    needed.every((i) => played.includes(i)) &&
    (!rootInBass || interval(lowestString()) === bass) &&
    (!slash || played.includes(bass))

  return ok ? { ...voicing, frets, fingers } : undefined
}

function encode({ frets, fingers, baseFret }) {
  return frets.map((f) => (f < 0 ? 'x' : f)).join('') + fingers.join('') + baseFret.toString(36)
}

for (const instrument of ['guitar', 'ukulele']) {
  const db = JSON.parse(
    readFileSync(require.resolve(`@tombatossals/chords-db/lib/${instrument}.json`), 'utf8'),
  )

  const instrumentInfo = {
    tuning: db.tunings.standard.map(midi),
    // the ukulele's high G string means its lowest string isn't the lowest note
    rootInBass: instrument === 'guitar',
  }

  // root pitch class -> chord type -> voicings
  const byRoot = new Map()
  const types = new Set()
  let removed = 0
  let fixed = 0
  for (const variants of Object.values(db.chords)) {
    for (const { key, suffix, positions } of variants) {
      const root = pitchClass(key)
      const type = chordType(root, suffix)
      if (!byRoot.has(root)) byRoot.set(root, { key, types: new Map() })
      const voicings = positions.flatMap((voicing) => {
        const checked = checkVoicing(root, type, voicing, instrumentInfo)
        if (!checked) removed++
        else if (checked.frets.join() !== voicing.frets.join()) fixed++
        return checked ? [checked] : []
      })
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
    `${instrument}: fixed ${fixed} and removed ${removed} voicings with the wrong notes, added ${added} chords by transposing`,
  )
}
