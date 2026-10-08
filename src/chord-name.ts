import type { Chord } from '@svguitar/core'
import guitar from './data/guitar.json'
import ukulele from './data/ukulele.json'
import { decodeVoicing } from './voicing'

export type Instrument = 'guitar' | 'ukulele'

// root -> suffix -> voicings separated by spaces, see decodeVoicing
const databases: Record<Instrument, Record<string, Record<string, string>>> = { guitar, ukulele }

const strings: Record<Instrument, number> = { guitar: 6, ukulele: 4 }

const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const qualityAliases: Record<string, string> = {
  '': 'major',
  M: 'major',
  maj: 'major',
  m: 'minor',
  min: 'minor',
  '-': 'minor',
  dim: 'dim',
  '°': 'dim',
  o: 'dim',
  '°7': 'dim7',
  o7: 'dim7',
  aug: 'aug',
  '+': 'aug',
  '+7': 'aug7',
  '7+': 'aug7',
  '7#5': 'aug7',
  '+9': 'aug9',
  '9+': 'aug9',
  '9#5': 'aug9',
  sus: 'sus4',
  // the database names these "b13b9" and "b13#9", which can't follow a root like "A" ("Ab13b9")
  '7b9b13': 'b13b9',
  '7b13b9': 'b13b9',
  '7#9b13': 'b13#9',
  '7b13#9': 'b13#9',
  M7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  M9: 'maj9',
  M11: 'maj11',
  M13: 'maj13',
  ø: 'm7b5',
  ø7: 'm7b5',
  mM7: 'mmaj7',
  'm(maj7)': 'mmaj7',
  mM9: 'mmaj9',
  mM11: 'mmaj11',
}

function pitchClass(note: string): number | undefined {
  const match = /^([A-G])([#b]*)$/.exec(note)
  if (!match) {
    return undefined
  }

  const accidentals = [...match[2]].reduce((sum, a) => sum + (a === '#' ? 1 : -1), 0)

  return (pitchClasses[match[1]] + accidentals + 12) % 12
}

/**
 * Finds the database key ("C#", "Eb", ...) or slash suffix bass note ("/G#", ...) that sounds like
 * the given note.
 */
function findEnharmonic(note: string, candidates: string[]): string | undefined {
  const pc = pitchClass(note)

  return pc === undefined ? undefined : candidates.find((candidate) => pitchClass(candidate) === pc)
}

function normalizeQuality(quality: string): string {
  const normalized = quality.replace(/^(min(?!or)|-)/, 'm').replace(/^(Maj|MAJ)/, 'maj')

  return qualityAliases[quality] ?? qualityAliases[normalized] ?? normalized
}

function findVoicings(name: string, instrument: Instrument): string[] {
  const db = databases[instrument]
  const normalized = name.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace('6/9', '69')
  const match = /^([A-G][#b]?)([^/]*)(?:\/(.+))?$/.exec(normalized)
  const key = match && findEnharmonic(match[1], Object.keys(db))

  if (!match || !key) {
    throw new Error(`Unknown ${instrument} chord "${name}"`)
  }

  const [, , quality, bass] = match
  const suffixes = db[key]
  let suffix = normalizeQuality(quality)

  if (bass !== undefined) {
    // the database only has major and minor slash chords, stored as "/E" and "m/E"
    const prefix = { major: '/', minor: 'm/' }[suffix] ?? ''
    const bassNotes = Object.keys(suffixes)
      .filter((s) => prefix && s.startsWith(prefix))
      .map((s) => s.slice(prefix.length))
    const bassNote = findEnharmonic(bass, bassNotes)
    suffix = bassNote ? `${prefix}${bassNote}` : ''
  }

  const voicings = suffixes[suffix]
  if (!voicings) {
    throw new Error(`Unknown ${instrument} chord "${name}"`)
  }

  return voicings.split(' ')
}

/**
 * Returns the chord diagram for a chord name like "C#", "Ebm7" or "D/F#".
 *
 * @param name The chord name
 * @param voicing Which voicing of the chord to return, starting at 0. See {@link chordVoicings}.
 * @param instrument The instrument to return the chord for
 * @throws If the chord or the voicing is not in the database.
 */
export function chordFromName(name: string, voicing = 0, instrument: Instrument = 'guitar'): Chord {
  const voicings = findVoicings(name, instrument)

  if (!Number.isInteger(voicing) || voicing < 0 || voicing >= voicings.length) {
    throw new Error(
      `Chord "${name}" has no voicing ${voicing}, it has ${voicings.length} (0 to ${voicings.length - 1})`,
    )
  }

  return decodeVoicing(voicings[voicing], strings[instrument], name)
}

/**
 * Returns the number of voicings available for a chord name.
 *
 * @param name The chord name
 * @param instrument The instrument to look the chord up for
 * @throws If the chord is not in the database.
 */
export function chordVoicings(name: string, instrument: Instrument = 'guitar'): number {
  return findVoicings(name, instrument).length
}

/**
 * Returns the guitar chord diagram for a chord name, see {@link chordFromName}.
 */
export function getGuitarChord(name: string, voicing = 0): Chord {
  return chordFromName(name, voicing, 'guitar')
}

/**
 * Returns the ukulele chord diagram (standard GCEA tuning) for a chord name, see
 * {@link chordFromName}.
 */
export function getUkuleleChord(name: string, voicing = 0): Chord {
  return chordFromName(name, voicing, 'ukulele')
}
