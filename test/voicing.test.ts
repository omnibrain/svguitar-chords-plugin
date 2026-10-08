import { decodeVoicing } from '../src/voicing'

describe('decodeVoicing', () => {
  test('decodes muted, open and fretted strings', () => {
    expect(decodeVoicing('x320100320101', 6, 'C')).toEqual({
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

  test('decodes the base fret in base 36', () => {
    expect(decodeVoicing('1133311123413', 6, 'C').position).toBe(3)
    expect(decodeVoicing('x1111x011110c', 6, 'X').position).toBe(12)
  })

  test('draws the same finger on several strings of the same fret as a barre', () => {
    // C9: frets 332333, fingers 221334
    expect(decodeVoicing('3323332213341', 6, 'C9')).toEqual({
      fingers: [
        [4, 2, '1'],
        [1, 3, '4'],
      ],
      barres: [
        { fromString: 6, toString: 5, fret: 3, text: '2' },
        { fromString: 3, toString: 2, fret: 3, text: '3' },
      ],
      title: 'C9',
    })
  })

  test('draws fretted strings without a finger as plain dots', () => {
    expect(decodeVoicing('x1100x0100001', 6, 'X').fingers).toEqual([
      [6, 'x'],
      [5, 1, '1'],
      [4, 1],
      [3, 0],
      [2, 0],
      [1, 'x'],
    ])
  })

  test('decodes ukulele voicings', () => {
    // Eb7sus4: frets 3344, fingers 1122
    expect(decodeVoicing('334411221', 4, 'Eb7sus4')).toEqual({
      fingers: [],
      barres: [
        { fromString: 4, toString: 3, fret: 3, text: '1' },
        { fromString: 2, toString: 1, fret: 4, text: '2' },
      ],
      title: 'Eb7sus4',
    })
  })
})
