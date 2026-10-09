import { chordFormulas } from '../src/chord-formulas'
import weights from '../src/data/voicing-weights.json'
import {
  assignFingers,
  candidates,
  fingersNeeded,
  playableVoicings,
  rankedVoicings,
  type ChordSpec,
  type Frets,
} from '../src/voicing-generator'

const guitar = { tuning: [40, 45, 50, 55, 59, 64], rootInBass: true }
const ukulele = { tuning: [67, 60, 64, 69], rootInBass: false, omitRootFrom: 4 }

const chord = (root: number, type: string, bass: number | null = null): ChordSpec => ({
  root,
  bass,
  required: chordFormulas[type][0],
  optional: chordFormulas[type][1],
})

const notes = (frets: Frets, tuning: number[]) =>
  frets.flatMap((fret, i) => (fret >= 0 ? [(tuning[i] + fret) % 12] : []))

describe('candidates', () => {
  const cMajor = candidates(chord(0, 'major'), guitar).map((frets) => frets.join())

  test('finds the common shapes', () => {
    expect(cMajor).toEqual(
      expect.arrayContaining([
        '-1,3,2,0,1,0', // open C
        '-1,3,5,5,5,3', // A shape
        '8,10,10,9,8,8', // E shape
      ]),
    )
  })

  test('lists each shape once, at its lowest position', () => {
    expect(cMajor).not.toContain('20,22,22,21,20,20')
    expect(new Set(cMajor).size).toBe(cMajor.length)
  })

  test.each(Object.keys(chordFormulas))(
    'only plays the notes of %s with the root in the bass',
    (type) => {
      const spec = chord(2, type)
      const allowed = [...spec.required, ...spec.optional].map((i) => (i + 2) % 12)

      candidates(spec, guitar).forEach((frets) => {
        const played = notes(frets, guitar.tuning)
        const fretted = frets.filter((f) => f > 0)

        expect(played[0]).toBe(2)
        spec.required.forEach((i) => expect(played).toContain((i + 2) % 12))
        played.forEach((note) => expect(allowed).toContain(note))
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
      })
    },
  )

  test('puts the bass of a slash chord lowest and plays an added bass note once', () => {
    // C/D
    const voicings = candidates(chord(0, 'major', 2), guitar)

    expect(voicings.length).toBeGreaterThan(0)
    voicings.forEach((frets) => {
      const played = notes(frets, guitar.tuning)
      expect(played[0]).toBe(2)
      expect(played.filter((note) => note === 2)).toHaveLength(1)
    })
  })

  test('lets the ukulele leave out the root of chords with four or more notes', () => {
    // C9 has more notes than the ukulele has strings
    const c9 = candidates(chord(0, '9'), ukulele)

    expect(c9.some((frets) => !notes(frets, ukulele.tuning).includes(0))).toBe(true)
    expect(candidates(chord(0, 'major'), ukulele).map((frets) => frets.join())).toContain('0,0,0,3')
  })
})

describe('fingersNeeded', () => {
  test.each([
    [[-1, 3, 2, 0, 1, 0], 3],
    [[1, 3, 3, 2, 1, 1], 3],
    [[-1, 3, 5, 5, 5, 3], 2],
    // a barre higher up only on adjacent strings
    [[8, 7, 5, 5, 8, 8], 4],
    // ...and not around a lower note
    [[8, 10, 8, 10, 8, 10], 4],
  ])('%j needs %d fingers', (frets, fingers) => {
    expect(fingersNeeded(frets, false)).toBe(fingers)
  })

  test('only barres the lowest fret if asked to', () => {
    expect(fingersNeeded([-1, 3, 5, 5, 5, 3], true)).toBe(4)
  })
})

describe('assignFingers', () => {
  test.each([
    [
      [-1, 3, 2, 0, 1, 0],
      [0, 3, 2, 0, 1, 0],
    ],
    [
      [1, 3, 3, 2, 1, 1],
      [1, 3, 4, 2, 1, 1],
    ],
    [
      [-1, 3, 5, 5, 5, 3],
      [0, 1, 2, 3, 4, 1],
    ],
    [
      [8, 7, 5, 5, 5, 8],
      [3, 2, 1, 1, 1, 4],
    ],
    [
      [-1, 3, 5, 5, 5, 5],
      [0, 1, 2, 2, 2, 2],
    ],
  ])('fingers %j with %j', (frets, fingers) => {
    expect(assignFingers(frets)).toEqual(fingers)
  })
})

describe('rankedVoicings', () => {
  test('returns playable voicings, the usual shapes among them', () => {
    const ranked = rankedVoicings(chord(0, 'major'), guitar, weights).map((frets) => frets.join())

    expect(ranked).toEqual(
      expect.arrayContaining(['-1,3,2,0,1,0', '-1,3,5,5,5,3', '8,10,10,9,8,8']),
    )
    expect(ranked.length).toBeLessThan(candidates(chord(0, 'major'), guitar).length)
  })

  test('only returns voicings that need at most four fingers', () => {
    const playable = new Set(
      playableVoicings(chord(0, 'm7'), guitar).map(({ frets }) => frets.join()),
    )

    rankedVoicings(chord(0, 'm7'), guitar, weights).forEach((frets) => {
      expect(fingersNeeded(frets, false)).toBeLessThanOrEqual(4)
      expect(playable).toContain(frets.join())
    })
  })

  test('returns the best three voicings if none scores well', () => {
    const none = { features: weights.features, weights: weights.weights.map(() => -1) }

    expect(rankedVoicings(chord(0, 'major'), guitar, none)).toHaveLength(3)
  })
})
