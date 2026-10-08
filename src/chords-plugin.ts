import type { SVGuitarChord } from '@svguitar/core'
import {
  chordFromName,
  chordVoicings,
  getGuitarChord,
  getUkuleleChord,
  type Instrument,
} from './chord-name'

export { chordFromName, chordVoicings, getGuitarChord, getUkuleleChord, type Instrument }

export interface ChordsPluginApi {
  /**
   * Sets a guitar chord to draw by its name, e.g. "C#". Also configures the diagram for 6 strings.
   *
   * @param name The chord name
   * @param voicing Which voicing of the chord to draw, starting at 0. See {@link chordVoicings}.
   */
  guitarChord(name: string, voicing?: number): SVGuitarChord

  /**
   * Sets a ukulele chord (standard GCEA tuning) to draw by its name, e.g. "C#". Also configures the
   * diagram for 4 strings.
   *
   * @param name The chord name
   * @param voicing Which voicing of the chord to draw, starting at 0. See {@link chordVoicings}.
   */
  ukuleleChord(name: string, voicing?: number): SVGuitarChord
}

/**
 * SVGuitar plugin that draws chords from their name.
 *
 * @example
 * const SVGuitarWithChords = SVGuitarChord.plugin(chordsPlugin)
 * new SVGuitarWithChords('#chart').guitarChord('C#').draw()
 * new SVGuitarWithChords('#chart').ukuleleChord('Am7').draw()
 */
export function chordsPlugin(instance: SVGuitarChord): ChordsPluginApi {
  return {
    guitarChord(name: string, voicing?: number) {
      return instance.configure({ strings: 6 }).chord(getGuitarChord(name, voicing))
    },
    ukuleleChord(name: string, voicing?: number) {
      return instance.configure({ strings: 4 }).chord(getUkuleleChord(name, voicing))
    },
  }
}

export default chordsPlugin
