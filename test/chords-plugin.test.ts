import { SVGuitarChord } from '@svguitar/core'
import { chordFromName, chordsPlugin } from '../src/chords-plugin'

describe('chordsPlugin', () => {
  const SVGuitarWithChords = SVGuitarChord.plugin(chordsPlugin)

  test('sets a guitar chord from its name', () => {
    const chart = new SVGuitarWithChords()
    const chord = jest.spyOn(chart, 'chord')
    const configure = jest.spyOn(chart, 'configure')

    expect(chart.guitarChord('C#m', 1)).toBe(chart)
    expect(chord).toHaveBeenCalledWith(chordFromName('C#m', 1))
    expect(configure).toHaveBeenCalledWith({ strings: 6 })
  })

  test('sets a ukulele chord from its name', () => {
    const chart = new SVGuitarWithChords()
    const chord = jest.spyOn(chart, 'chord')
    const configure = jest.spyOn(chart, 'configure')

    expect(chart.ukuleleChord('C#m', 1)).toBe(chart)
    expect(chord).toHaveBeenCalledWith(chordFromName('C#m', 1, 'ukulele'))
    expect(configure).toHaveBeenCalledWith({ strings: 4 })
  })

  test.each(['guitarChord', 'ukuleleChord'] as const)('%s draws the chord', (method) => {
    const chart = new SVGuitarWithChords()

    chart[method]('F').draw()

    expect(chart.toSvg()).toContain('<svg')
  })
})
