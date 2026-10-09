import type { Chord } from '@svguitar/core'
import { chordFormulas } from './chord-formulas'
import guitar from './data/guitar.json'
import ukulele from './data/ukulele.json'
import unavailableChords from './data/unavailable-chords.json'
import weights from './data/voicing-weights.json'
import { decodeFrets, decodeVoicing, encodeVoicing } from './voicing'
import { rankedVoicings, type Frets, type Instrument as Tuning } from './voicing-generator'

export type Instrument = 'guitar' | 'ukulele'

// root -> suffix -> voicings separated by spaces, see decodeVoicing
const databases: Record<Instrument, Record<string, Record<string, string>>> = { guitar, ukulele }

const strings: Record<Instrument, number> = { guitar: 6, ukulele: 4 }

const tunings: Record<Instrument, Tuning> = {
  guitar: { tuning: [40, 45, 50, 55, 59, 64], rootInBass: true },
  // the high G string means the lowest string isn't the lowest note, and ukulele chords rarely
  // have the root in the bass
  ukulele: { tuning: [67, 60, 64, 69], rootInBass: false, omitRootFrom: 4 },
}

const noteNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

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
  '6add9': '69',
  m6add9: 'm69',
  augmaj7: 'maj7#5',
  '+maj7': 'maj7#5',
  'maj7#11': 'maj#11',
  'Δ#11': 'maj#11',
  add2: 'add9',
  madd2: 'madd9',
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

function parseName(name: string) {
  const normalized = name.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace('6/9', '69')

  return /^([A-G][#b]?)([^/]*)(?:\/(.+))?$/.exec(normalized)
}

interface ChordId {
  /** The root as spelled in the database, e.g. "C#" */
  key: string
  root: number
  /** The chord type, e.g. "minor" or "maj7" */
  quality: string
  bass: number | null
}

/**
 * The database suffix of a chord, e.g. "m/E" for an A minor chord over E, if the database has it.
 */
function curatedSuffix(
  { key, quality, bass }: ChordId,
  instrument: Instrument,
): string | undefined {
  const suffixes = databases[instrument][key]
  if (bass === null) {
    return quality in suffixes ? quality : undefined
  }

  // the database only has major and minor slash chords, stored as "/E" and "m/E"
  const prefix = ({ major: '/', minor: 'm/' } as Record<string, string>)[quality]
  const bassNote =
    prefix &&
    Object.keys(suffixes).find(
      (s) => s.startsWith(prefix) && pitchClass(s.slice(prefix.length)) === bass,
    )

  return bassNote || undefined
}

/**
 * Finds the chord a name stands for, e.g. "Db/F" -> C# major over F.
 */
function findChord(name: string, instrument: Instrument): ChordId | undefined {
  const match = parseName(name)
  const key = match && findEnharmonic(match[1], Object.keys(databases[instrument]))
  if (!match || !key) {
    return undefined
  }

  const root = pitchClass(key) as number
  const bass = match[3] === undefined ? null : pitchClass(match[3])
  if (bass === undefined || bass === root) {
    return undefined
  }

  const chord = { key, root, quality: normalizeQuality(match[2]), bass }
  const known = curatedSuffix(chord, instrument) !== undefined || chord.quality in chordFormulas

  return known ? chord : undefined
}

// chord type (and semitones of the bass above the root) -> roots as a bit mask, see scripts/find-unavailable-chords.mts
const unavailable: Record<Instrument, Record<string, string>> = unavailableChords

function isUnavailable({ root, quality, bass }: ChordId, instrument: Instrument): boolean {
  const kind = quality + (bass === null ? '' : `/${(bass - root + 12) % 12}`)
  const roots = unavailable[instrument][kind]

  return roots !== undefined && (parseInt(roots, 16) & (1 << root)) !== 0
}

// open voicings first, then from the nut up the neck
const position = (frets: Frets) => (frets.includes(0) ? 0 : Math.min(...frets.filter((f) => f > 0)))

const generated = new Map<string, string[]>()

/**
 * The voicings of a chord: those of the chord database first, then the generated ones.
 */
function voicingsOf(chord: ChordId, instrument: Instrument): string[] {
  const id = `${instrument} ${chord.root} ${chord.quality} ${chord.bass}`
  const cached = generated.get(id)
  if (cached) {
    return cached
  }

  const curated = curatedSuffix(chord, instrument)
  const voicings = curated ? databases[instrument][chord.key][curated].split(' ') : []
  const formula = chordFormulas[chord.quality]

  if (formula) {
    const n = strings[instrument]
    const frets = (voicing: string) => decodeFrets(voicing, n).join()
    const known = new Set(voicings.map(frets))
    rankedVoicings(
      { root: chord.root, bass: chord.bass, required: formula[0], optional: formula[1] },
      tunings[instrument],
      weights,
    )
      .sort((a, b) => position(a) - position(b))
      .forEach((f: Frets) => {
        const voicing = encodeVoicing(f)
        if (!known.has(f.join())) {
          known.add(f.join())
          voicings.push(voicing)
        }
      })
  }

  generated.set(id, voicings)
  return voicings
}

function findVoicings(name: string, instrument: Instrument): string[] {
  const chord = findChord(name, instrument)
  const voicings = chord ? voicingsOf(chord, instrument) : []
  if (voicings.length === 0) {
    throw new Error(`Unknown ${instrument} chord "${name}"`)
  }

  return voicings
}

/**
 * How a database suffix is written in a chord name, e.g. "minor" -> "m".
 */
function displaySuffix(suffix: string): string {
  return { major: '', minor: 'm', b13b9: '7b9b13', 'b13#9': '7#9b13' }[suffix] ?? suffix
}

// major and minor first and slash chords last, otherwise the shortest names first
function compareNames(a: string, b: string): number {
  const rank = (name: string) => (name === '' ? 0 : name === 'm' ? 1 : name.includes('/') ? 3 : 2)

  return rank(a) - rank(b) || a.length - b.length || a.localeCompare(b)
}

const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']
const sharpKeys = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#']

/** How the bass note of a slash chord is spelled for a root */
function bassName(bass: number, key: string): string {
  const name = noteNames[bass]
  const flat = name.endsWith('b')
  if (flat && sharpKeys.includes(key)) return noteNames[bass - 1] + '#'
  if (!flat && name.endsWith('#') && flatKeys.includes(key)) return noteNames[(bass + 1) % 12] + 'b'
  return name
}

const suffixLists = new Map<string, { suffix: string; chord: ChordId }[]>()

/**
 * Every chord of a root, written as the part of the name after the root (e.g. "m7" or "/E"),
 * sorted like {@link compareNames}.
 */
function chordsOfRoot(key: string, instrument: Instrument) {
  const id = `${instrument} ${key}`
  const cached = suffixLists.get(id)
  if (cached) {
    return cached
  }

  const root = pitchClass(key) as number
  const qualities = new Set([
    ...Object.keys(databases[instrument][key]).filter((s) => !s.includes('/')),
    ...Object.keys(chordFormulas),
  ])
  const chords: ChordId[] = [...qualities].map((quality) => ({ key, root, quality, bass: null }))
  // slash chords for every bass note: those the database has and those the generator can make
  ;[...qualities].forEach((quality) =>
    noteNames.forEach((_, bass) => {
      if (bass === root) return
      const chord = { key, root, quality, bass }
      if (quality in chordFormulas || curatedSuffix(chord, instrument)) chords.push(chord)
    }),
  )

  const list = chords
    .filter((chord) => curatedSuffix(chord, instrument) || !isUnavailable(chord, instrument))
    .map((chord) => ({ suffix: displayName(chord).slice(key.length), chord }))
    .sort((a, b) => compareNames(a.suffix, b.suffix))
  suffixLists.set(id, list)
  return list
}

function displayName({ key, quality, bass }: ChordId): string {
  return key + displaySuffix(quality) + (bass === null ? '' : '/' + bassName(bass, key))
}

/**
 * Returns the names of all chords of an instrument, e.g. "C", "Cm", "C6", ..., "Bm/F#".
 */
export function chordNames(instrument: Instrument = 'guitar'): string[] {
  return Object.keys(databases[instrument]).flatMap((key) =>
    chordsOfRoot(key, instrument).map(({ suffix }) => key + suffix),
  )
}

/**
 * Returns the names of the chords that match a search, for chord suggestions while typing. A chord
 * the search names exactly (e.g. "CM7") comes first, followed by the chords that start with the
 * search (e.g. "Cm" -> "Cm", "Cm6", "Cm7", ..., "Cmaj7"), shortest first and slash chords last. The
 * root is spelled like in the search and may be lowercase ("db" -> "Db...").
 *
 * @param query What the user typed
 * @param instrument The instrument to search the chords of
 * @param limit The maximum number of chord names to return
 */
export function searchChords(
  query: string,
  instrument: Instrument = 'guitar',
  limit = Infinity,
): string[] {
  const search = query
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/^[a-g]/, (root) => root.toUpperCase())
  const root = /^[A-G][#b]?/.exec(search)?.[0]
  const key = root && findEnharmonic(root, Object.keys(databases[instrument]))
  if (!root || !key) {
    return []
  }

  const typed = search.slice(root.length)
  const exact = findChord(search, instrument)
  const exactSuffix = exact && displayName(exact).slice(key.length)
  const suffixes = chordsOfRoot(key, instrument)
    .map(({ suffix }) => suffix)
    .filter((suffix) => suffix !== exactSuffix && suffix.startsWith(typed))

  return [...(exactSuffix !== undefined ? [exactSuffix] : []), ...suffixes]
    .slice(0, limit)
    .map((suffix) => root + suffix)
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
