import { SVGuitarChord } from '@svguitar/core'
import { chordFromName, chordsPlugin } from '../src/chords-plugin'

describe('chordsPlugin', () => {
  const SVGuitarWithChords = SVGuitarChord.plugin(chordsPlugin)

  test('adds a chainable chordName method', () => {
    const chart = new SVGuitarWithChords()

    expect(chart.chordName('C#')).toBe(chart)
  })

  test('draws the chord', () => {
    const chart = new SVGuitarWithChords()

    chart.chordName('C#').draw()

    expect(chart.toSvg()).toContain('<svg')
  })
})

describe('chordFromName', () => {
  test('returns an empty chord (placeholder)', () => {
    expect(chordFromName('C#')).toEqual({ fingers: [], barres: [] })
  })
})
