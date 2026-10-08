import { chordFromName, chordVoicings } from '../src/chord-name'
import guitar from '../src/data/guitar.json'
import ukulele from '../src/data/ukulele.json'

describe('chordFromName', () => {
  test('converts an open chord', () => {
    expect(chordFromName('C')).toEqual({
      fingers: [
        [6, 'x'],
        [5, 3, '3'],
        [4, 2, '2'],
        [3, 0],
        [2, 1, '1'],
        [1, 0],
      ],
      barres: [],
      title: 'C',
    })
  })

  test('converts a barre chord', () => {
    expect(chordFromName('F')).toEqual({
      fingers: [
        [5, 3, '3'],
        [4, 3, '4'],
        [3, 2, '2'],
      ],
      barres: [{ fromString: 6, toString: 1, fret: 1, text: '1' }],
      title: 'F',
    })
  })

  test('sets the position of chords higher up the neck', () => {
    expect(chordFromName('C', 1)).toEqual({
      fingers: [
        [4, 3, '2'],
        [3, 3, '3'],
        [2, 3, '4'],
      ],
      barres: [{ fromString: 6, toString: 1, fret: 1, text: '1' }],
      title: 'C',
      position: 3,
    })
  })

  test('only draws the barre across the strings of the barre finger', () => {
    // frets x22122, fingers 022134
    const voicing = guitar.C['69'].split(' ').findIndex((v) => v.startsWith('x22122'))

    expect(chordFromName('C6/9', voicing)).toEqual({
      fingers: [
        [6, 'x'],
        [3, 1, '1'],
        [2, 2, '3'],
        [1, 2, '4'],
      ],
      barres: [{ fromString: 5, toString: 4, fret: 2, text: '2' }],
      title: 'C6/9',
      position: 9,
    })
  })

  test.each([
    ['C#', 'C#', 'major'],
    ['Db', 'C#', 'major'],
    ['C♯', 'C#', 'major'],
    ['D♭', 'C#', 'major'],
    ['A#m', 'Bb', 'minor'],
    ['Ebm7', 'Eb', 'm7'],
    ['Gbmaj7', 'F#', 'maj7'],
    ['CM7', 'C', 'maj7'],
    ['CMaj7', 'C', 'maj7'],
    ['CΔ', 'C', 'maj7'],
    ['Cmin', 'C', 'minor'],
    ['C-7', 'C', 'm7'],
    ['C°', 'C', 'dim'],
    ['C°7', 'C', 'dim7'],
    ['C+', 'C', 'aug'],
    ['Cø', 'C', 'm7b5'],
    ['CmM7', 'C', 'mmaj7'],
    ['Csus', 'C', 'sus4'],
    ['Cmaj', 'C', 'major'],
    ['D/F#', 'D', '/F#'],
    ['D/Gb', 'D', '/F#'],
    ['Am/C', 'A', 'm/C'],
    [' Am ', 'A', 'minor'],
  ])('understands "%s"', (name, key, suffix) => {
    const db: Record<string, Record<string, string>> = guitar

    expect(chordVoicings(name)).toBe(db[key][suffix].split(' ').length)
    expect(chordFromName(name)).toEqual({ ...chordFromName(`${key}${suffix}`), title: name })
  })

  test.each(['H', 'Cxyz', 'C/C', 'C7/E', 'C/H', ''])('throws for unknown chord "%s"', (name) => {
    expect(() => chordFromName(name)).toThrow(`Unknown guitar chord "${name}"`)
  })

  test.each([-1, 4, 1.5])('throws for a missing voicing %d', (voicing) => {
    expect(() => chordFromName('C', voicing)).toThrow('Chord "C" has no voicing')
  })

  test('converts a ukulele chord', () => {
    expect(chordFromName('C', 0, 'ukulele')).toEqual({
      fingers: [
        [4, 0],
        [3, 0],
        [2, 0],
        [1, 3, '3'],
      ],
      barres: [],
      title: 'C',
    })
  })

  test('converts a ukulele barre chord', () => {
    // frets [1, 1, 1, 4], fingers [1, 1, 1, 4]
    expect(chordFromName('D', 1, 'ukulele')).toEqual({
      fingers: [[1, 4, '4']],
      barres: [{ fromString: 4, toString: 2, fret: 1, text: '1' }],
      title: 'D',
      position: 2,
    })
  })

  test.each([
    ['Ab7b9b13', 'b13b9'],
    ['Ab7b13b9', 'b13b9'],
    ['Ab7#9b13', 'b13#9'],
    ['Ab7b13#9', 'b13#9'],
  ])('understands ukulele chord "%s"', (name, suffix) => {
    expect(chordFromName(name, 0, 'ukulele')).toEqual({
      ...chordFromName(`Ab${suffix}`, 0, 'ukulele'),
      title: name,
    })
  })

  test('finds ukulele chords stored under the other enharmonic name', () => {
    expect(chordVoicings('C#m', 'ukulele')).toBe(ukulele.Db.minor.split(' ').length)
  })

  test('throws for chords the ukulele database does not have', () => {
    expect(() => chordFromName('D/F#', 0, 'ukulele')).toThrow('Unknown ukulele chord "D/F#"')
  })

  test('has chords transposed from other roots', () => {
    // the database only has slash chords for some roots, D#/G is moved from D/F#
    expect(chordVoicings('D#/G')).toBeGreaterThan(0)
    expect(chordVoicings('Bbm/Db')).toBeGreaterThan(0)
    expect(chordVoicings('F#7sg')).toBeGreaterThan(0)
  })

  test.each([
    ['guitar', guitar, 709],
    ['ukulele', ukulele, 552],
  ] as const)('converts every %s chord in the database', (instrument, db, count) => {
    const names = Object.entries(db).flatMap(([key, suffixes]) =>
      Object.keys(suffixes).map((suffix) => key + suffix.replace(/^b13(.)9$/, '7$19b13')),
    )

    expect(names).toHaveLength(count)
    names.forEach((name) => {
      for (let voicing = 0; voicing < chordVoicings(name, instrument); voicing += 1) {
        const { fingers, barres } = chordFromName(name, voicing, instrument)

        expect(fingers.length + barres.length).toBeGreaterThan(0)
        barres.forEach((barre) => expect(barre.fromString).toBeGreaterThan(barre.toString))
      }
    })
  })
})

describe('chordVoicings', () => {
  test('returns the number of voicings', () => {
    expect(chordVoicings('C')).toBe(4)
  })
})
