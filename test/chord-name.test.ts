import {
  chordFromName,
  chordNames,
  chordVoicings,
  getGuitarChord,
  getUkuleleChord,
  searchChords,
} from '../src/chord-name'
import guitar from '../src/data/guitar.json'
import ukulele from '../src/data/ukulele.json'
import { decodeVoicing } from '../src/voicing'

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
    // x35553: the barre doesn't cover the low E string, it would put G in the bass
    expect(chordFromName('C', 1)).toEqual({
      fingers: [
        [6, 'x'],
        [4, 3, '2'],
        [3, 3, '3'],
        [2, 3, '4'],
      ],
      barres: [{ fromString: 5, toString: 1, fret: 1, text: '1' }],
      title: 'C',
      position: 3,
    })
  })

  test('only draws the barre across the strings of the barre finger', () => {
    // frets 211122, fingers 211134: three fingers on the 2nd fret but no barre there
    const voicing = guitar.C['69'].split(' ').findIndex((v) => v.startsWith('211122211134'))

    expect(chordFromName('C6/9', voicing)).toEqual({
      fingers: [
        [6, 2, '2'],
        [2, 2, '3'],
        [1, 2, '4'],
      ],
      barres: [{ fromString: 5, toString: 3, fret: 1, text: '1' }],
      title: 'C6/9',
      position: 7,
    })
  })

  test.each([
    ['C#', 'C#'],
    ['Db', 'C#'],
    ['C♯', 'C#'],
    ['D♭', 'C#'],
    ['A#m', 'Bbm'],
    ['Ebm7', 'Ebm7'],
    ['Gbmaj7', 'F#maj7'],
    ['CM7', 'Cmaj7'],
    ['CMaj7', 'Cmaj7'],
    ['CΔ', 'Cmaj7'],
    ['Cmin', 'Cm'],
    ['C-7', 'Cm7'],
    ['C°', 'Cdim'],
    ['C°7', 'Cdim7'],
    ['C+', 'Caug'],
    ['Cø', 'Cm7b5'],
    ['CmM7', 'Cmmaj7'],
    ['Csus', 'Csus4'],
    ['Cmaj', 'C'],
    ['C6add9', 'C69'],
    ['Cmaj7#11', 'Cmaj#11'],
    ['D/F#', 'D/F#'],
    ['D/Gb', 'D/F#'],
    ['Am/C', 'Am/C'],
    [' Am ', 'Am'],
  ])('understands "%s"', (name, canonical) => {
    expect(chordVoicings(name)).toBe(chordVoicings(canonical))
    expect(chordFromName(name)).toEqual({ ...chordFromName(canonical), title: name })
  })

  test.each(['H', 'Cxyz', 'C/C', 'Cxyz/E', 'C/H', ''])('throws for unknown chord "%s"', (name) => {
    expect(() => chordFromName(name)).toThrow(`Unknown guitar chord "${name}"`)
  })

  test.each([-1, 1.5, Infinity])('throws for a missing voicing %d', (voicing) => {
    expect(() => chordFromName('C', voicing)).toThrow('Chord "C" has no voicing')
  })

  test('throws for the voicing after the last', () => {
    expect(() => chordFromName('C', chordVoicings('C'))).toThrow('Chord "C" has no voicing')
  })

  test('lists the voicings of the chord database first', () => {
    const curated = guitar.C.major.split(' ')

    expect(chordVoicings('C')).toBeGreaterThan(curated.length)
    curated.forEach((voicing, i) =>
      expect(chordFromName('C', i)).toEqual(decodeVoicing(voicing, 6, 'C')),
    )
  })

  test('generates chords the database does not have', () => {
    // C power chord at the 3rd fret: x355xx
    expect(chordVoicings('C5')).toBeGreaterThan(1)
    // x57566
    expect(chordFromName('Bbmaj9/D')).toEqual({
      fingers: [
        [6, 'x'],
        [4, 3, '4'],
        [2, 2, '2'],
        [1, 2, '3'],
      ],
      barres: [{ fromString: 5, toString: 3, fret: 1, text: '1' }],
      title: 'Bbmaj9/D',
      position: 5,
    })
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
    expect(chordVoicings('C#m', 'ukulele')).toBe(chordVoicings('Dbm', 'ukulele'))
    expect(chordFromName('C#m', 0, 'ukulele')).toEqual(
      decodeVoicing(ukulele.Db.minor.split(' ')[0], 4, 'C#m'),
    )
  })

  test('throws for chords that cannot be played on the ukulele', () => {
    expect(() => chordFromName('C6/Bb', 0, 'ukulele')).toThrow('Unknown ukulele chord "C6/Bb"')
    expect(chordNames('ukulele')).not.toContain('C6/Bb')
  })

  test('has chords transposed from other roots', () => {
    // the database only has slash chords for some roots, D#/G is moved from D/F#
    expect(chordVoicings('D#/G')).toBeGreaterThan(0)
    expect(chordVoicings('Bbm/Db')).toBeGreaterThan(0)
    expect(chordVoicings('F#7sg')).toBeGreaterThan(0)
  })

  test.each(['guitar', 'ukulele'] as const)(
    'converts every voicing of every %s chord',
    (instrument) => {
      chordNames(instrument).forEach((name) => {
        for (let voicing = 0; voicing < chordVoicings(name, instrument); voicing += 1) {
          const { fingers, barres } = chordFromName(name, voicing, instrument)

          expect(fingers.length + barres.length).toBeGreaterThan(0)
          barres.forEach((barre) => expect(barre.fromString).toBeGreaterThan(barre.toString))
        }
      })
    },
    120_000,
  )
})

describe('getGuitarChord', () => {
  test('returns the guitar chord', () => {
    expect(getGuitarChord('Am')).toEqual(chordFromName('Am', 0, 'guitar'))
    expect(getGuitarChord('Am', 2)).toEqual(chordFromName('Am', 2, 'guitar'))
  })
})

describe('getUkuleleChord', () => {
  test('returns the ukulele chord', () => {
    expect(getUkuleleChord('Am')).toEqual(chordFromName('Am', 0, 'ukulele'))
    expect(getUkuleleChord('Am', 2)).toEqual(chordFromName('Am', 2, 'ukulele'))
  })
})

describe('chordNames', () => {
  test.each([
    ['guitar', 9245],
    ['ukulele', 7092],
  ] as const)(
    'returns every %s chord name, all of which can be looked up',
    (instrument, count) => {
      const names = chordNames(instrument)

      expect(names).toHaveLength(count)
      expect(new Set(names).size).toBe(count)
      names.forEach((name) => expect(chordVoicings(name, instrument)).toBeGreaterThan(0))
    },
    60_000,
  )

  test('lists major, minor, the other chords and then slash chords for each root', () => {
    const names = chordNames()

    expect(names.slice(0, 5)).toEqual(['C', 'Cm', 'C5', 'C6', 'C7'])
    expect(names.indexOf('C/E')).toBeGreaterThan(names.indexOf('Cmmaj13'))
    expect(names.indexOf('C#')).toBeGreaterThan(names.indexOf('Cmmaj13/B'))
  })

  test('spells the bass of slash chords like the key', () => {
    expect(chordNames()).toEqual(expect.arrayContaining(['E/D#', 'F/Eb', 'C/Eb', 'Bm7/A#']))
  })

  test('defaults to the guitar', () => {
    expect(chordNames()).toEqual(chordNames('guitar'))
  })
})

describe('searchChords', () => {
  test('returns the chords that start with the search', () => {
    expect(searchChords('Am', 'guitar', 4)).toEqual(['Am', 'Am6', 'Am7', 'Am9'])
    expect(searchChords('Am7', 'guitar', 3)).toEqual(['Am7', 'Am7#5', 'Am7b5'])
  })

  test('puts the exact chord first, even if written differently', () => {
    expect(searchChords('CM7')).toEqual(['Cmaj7'])
    expect(searchChords('Cmaj', 'guitar', 3)).toEqual(['C', 'Cmaj7', 'Cmaj9'])
    expect(searchChords('C6/9', 'guitar', 1)).toEqual(['C69'])
  })

  test('spells the root like the search', () => {
    expect(searchChords('Db', 'guitar', 2)).toEqual(['Db', 'Dbm'])
    expect(searchChords('C#', 'ukulele', 2)).toEqual(['C#', 'C#m'])
    expect(searchChords('c♯m', 'guitar', 1)).toEqual(['C#m'])
  })

  test('suggests slash chords', () => {
    expect(searchChords('D/', 'guitar', 3)).toEqual(['D/A', 'D/B', 'D/C'])
  })

  test.each(['', ' ', 'H', 'xyz', 'Cxyz'])('returns nothing for "%s"', (query) => {
    expect(searchChords(query)).toEqual([])
  })
})

describe('chordVoicings', () => {
  test('returns the number of voicings', () => {
    expect(chordVoicings('C')).toBe(15)
  })
})
