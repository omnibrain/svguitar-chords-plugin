import type { SVGuitarChord } from '@svguitar/core'
import { chordFromName } from './chord-name'

export { chordFromName }

export interface ChordsPluginApi {
  /**
   * Sets the chord to draw by its name, e.g. "C#".
   */
  chordName(name: string): SVGuitarChord
}

/**
 * SVGuitar plugin that draws chords from their name.
 *
 * @example
 * const SVGuitarWithChords = SVGuitarChord.plugin(chordsPlugin)
 * new SVGuitarWithChords('#chart').chordName('C#').draw()
 */
export function chordsPlugin(instance: SVGuitarChord): ChordsPluginApi {
  return {
    chordName(name: string) {
      return instance.chord(chordFromName(name))
    },
  }
}

export default chordsPlugin
