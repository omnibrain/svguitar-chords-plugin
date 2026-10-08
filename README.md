# @svguitar/chords-plugin

[SVGuitar](https://github.com/omnibrain/svguitar) plugin to draw guitar and ukulele chord diagrams from a chord name like `C#`.

## Installation

```bash
npm install @svguitar/core @svguitar/chords-plugin
```

`@svguitar/core` is a peer dependency and is not bundled with this plugin.

## Usage

```ts
import { SVGuitarChord } from '@svguitar/core'
import { chordsPlugin } from '@svguitar/chords-plugin'

const SVGuitarWithChords = SVGuitarChord.plugin(chordsPlugin)

new SVGuitarWithChords('#chart').guitarChord('C#').draw()
new SVGuitarWithChords('#chart').ukuleleChord('C#').draw()

// most chords have several voicings, pick one by index (starting at 0)
new SVGuitarWithChords('#chart').guitarChord('C', 1).draw()
```

`guitarChord()` and `ukuleleChord()` set the fingers, barres, position and title (the chord name as
given), and configure the number of strings (6 or 4). Ukulele chords are for standard GCEA tuning.
Unknown chords and voicings throw an error.

The chord data can also be used without drawing:

```ts
import { chordFromName, chordVoicings } from '@svguitar/chords-plugin'

chordVoicings('Am7') // number of guitar voicings
chordFromName('Am7', 0) // SVGuitar chord: { fingers, barres, position?, title }
chordFromName('Am7', 0, 'ukulele')
```

### Chord names

Roots `C` to `B` with `#`/`b` (or `♯`/`♭`), e.g. `C#`, `Db`, `Ebm7`, `F#maj7`, `Bbsus4`, `C6/9`, `D/F#`,
`Am/C`. On the guitar, all 12 roots support these chords:

`major` (`C`, `CM`, `Cmaj`), `minor` (`Cm`, `Cmin`, `C-`), `dim` (`C°`), `dim7` (`C°7`), `sus2`,
`sus4` (`Csus`), `7sus4`, `alt`, `aug` (`C+`), `6`, `69` (`C6/9`), `7`, `7b5`, `aug7`
(`C+7`, `C7#5`), `9`, `9b5`, `aug9` (`C+9`), `7b9`, `7#9`, `11`, `9#11`, `13`, `maj7` (`CM7`, `CΔ`),
`maj7b5`, `maj7#5`, `maj9`, `maj11`, `maj13`, `m6`, `m69`, `m7` (`C-7`), `m7b5` (`Cø`), `m9`, `m11`,
`mmaj7` (`CmM7`), `mmaj7b5`, `mmaj9`, `mmaj11`, `add9`, `madd9`.

Slash chords are available for every root, with the same bass notes relative to the root as for
`C`:

- major: `C/C#`, `C/D`, `C/Eb`, `C/E`, `C/F`, `C/G`, `C/Ab`, `C/A`, `C/Bb`, `C/B`
- minor: `Cm/D`, `Cm/Eb`, `Cm/E`, `Cm/G`, `Cm/Ab`, `Cm/A`, `Cm/Bb`, `Cm/B`, and `Em/F` only for `E`

The ukulele has the same chords except slash chords and `7sg`, plus `7b9#5`, `m9b5`, `13b9`,
`13b5b9`, `7b9b13` and `7#9b13`.

## Development

```bash
npm install
npm test        # tests with coverage
npm run lint
npm run build   # UMD + ES builds in dist/
```

The chord data in `src/data/` is generated from
[@tombatossals/chords-db](https://github.com/tombatossals/chords-db) with `npm run generate:chords`.
Chords the database only has for some roots are added for the other roots by moving shapes without
open strings along the neck. Each voicing is stored as a short string (see `src/voicing.ts`) and
converted to an SVGuitar chord when it is drawn.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint).

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). Every push to
`main` updates a release PR with the next version and changelog. Merging that PR tags the release
and publishes the package to npm. Publishing needs an `NPM_TOKEN` repository secret.

## License

MIT

Chord data from [chords-db](https://github.com/tombatossals/chords-db) by David Rubert, MIT
licensed.
