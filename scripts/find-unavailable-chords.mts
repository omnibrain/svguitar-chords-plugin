/*
 * Lists the chords that can't be played: those the chord database doesn't have and the generator
 * finds no playable voicing for, e.g. most slash chords on a ukulele. Written to
 * src/data/unavailable-chords.json as chord type (with "/" and the semitones of the bass above the
 * root for slash chords) -> roots it is unavailable for, as a 12-bit mask (bit 0 = C).
 *
 * Run with: node scripts/find-unavailable-chords.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chordFormulas } from '../src/chord-formulas.ts'
import { playableVoicings, type Instrument } from '../src/voicing-generator.ts'

const instruments: Record<string, Instrument> = {
  guitar: { tuning: [40, 45, 50, 55, 59, 64], rootInBass: true },
  ukulele: { tuning: [67, 60, 64, 69], rootInBass: false, omitRootFrom: 4 },
}
const pitchClass = (note: string) =>
  ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[note[0]]! +
  ([...note.slice(1)].reduce((sum, a) => sum + (a === '#' ? 1 : -1), 12) % 12)

const result: Record<string, Record<string, string>> = {}
for (const [name, instrument] of Object.entries(instruments)) {
  const db: Record<string, Record<string, string>> = JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  )
  const masks: Record<string, number> = {}
  for (const [key, suffixes] of Object.entries(db)) {
    const root = pitchClass(key) % 12
    for (const [quality, [required, optional]] of Object.entries(chordFormulas)) {
      for (const bass of [null, ...Array.from({ length: 12 }, (_, i) => i)]) {
        if (bass === root) continue
        const interval = bass === null ? null : (bass - root + 12) % 12
        const curated =
          bass === null
            ? quality in suffixes
            : Object.keys(suffixes).some(
                (s) =>
                  s.startsWith(
                    ({ major: '/', minor: 'm/' } as Record<string, string>)[quality] ?? '-',
                  ) && pitchClass(s.slice(s.indexOf('/') + 1)) % 12 === bass,
              )
        if (curated || playableVoicings({ root, bass, required, optional }, instrument).length)
          continue
        const kind = quality + (interval === null ? '' : `/${interval}`)
        masks[kind] = (masks[kind] ?? 0) | (1 << root)
      }
    }
  }
  result[name] = Object.fromEntries(
    Object.entries(masks).map(([kind, mask]) => [kind, mask.toString(16)]),
  )
  console.log(`${name}: ${Object.keys(masks).length} chord types with unavailable roots`)
}

writeFileSync(
  new URL('../src/data/unavailable-chords.json', import.meta.url),
  JSON.stringify(result) + '\n',
)
