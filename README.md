# @svguitar/chords-plugin

[SVGuitar](https://github.com/omnibrain/svguitar) plugin to draw guitar and ukulele chord diagrams from a chord name like `C#`.

It knows over 9,000 guitar chords with about 72,000 voicings and over 7,000 ukulele chords: 65
chord types on all 12 roots, each also over every bass note. Common chords come from a hand-made chord
database, and the plugin works out the other voicings itself.

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
import { chordFromName, chordVoicings, getGuitarChord, getUkuleleChord } from '@svguitar/chords-plugin'

getGuitarChord('Am7') // SVGuitar chord: { fingers, barres, position?, title }
getUkuleleChord('Am7', 1) // second voicing
chordVoicings('Am7') // number of guitar voicings
chordVoicings('Am7', 'ukulele')

// or with the instrument as a parameter
chordFromName('Am7', 0, 'ukulele')
```

To suggest chords while typing, `searchChords()` returns the chord names that start with a search,
the exact chord first. `chordNames()` returns all chord names of an instrument.

```ts
import { searchChords, chordNames } from '@svguitar/chords-plugin'

searchChords('Am', 'guitar', 4) // ['Am', 'Am6', 'Am7', 'Am9']
searchChords('CM7') // ['Cmaj7']
chordNames('ukulele') // ['C', 'Cm', 'C6', ...]
```

### Chord names

Roots `C` to `B` with `#`/`b` (or `♯`/`♭`), followed by the chord type and optionally `/` and a bass
note, e.g. `C#`, `Db`, `Ebm7`, `F#maj7`, `Bbsus4`, `C6/9`, `D/F#`, `Am7/G`. The chord types:

- triads: major (`C`, `CM`, `Cmaj`), minor (`Cm`, `Cmin`, `C-`), `5`, `dim` (`C°`), `aug` (`C+`),
  `sus2`, `sus4` (`Csus`), `sus2sus4`, `majb5`, `m#5`, `mbb5`, `sus2b5`, `sus2#5`, `sus4#5`
- sixths: `6`, `69` (`C6/9`, `C6add9`), `6b5`, `m6`, `m69`
- sevenths: `7`, `maj7` (`CM7`, `CΔ`), `m7` (`C-7`), `mmaj7` (`CmM7`), `dim7` (`C°7`), `m7b5` (`Cø`),
  `7b5`, `aug7` (`C+7`, `C7#5`), `maj7b5`, `maj7#5` (`Caugmaj7`), `m7#5`, `mmaj7b5`, `mmaj7#5`,
  `mmaj7bb5`, `7sus2`, `7sus4`, `7sus2sus4`, `7sus2#5`, `7sus4#5`, `maj7sus2`, `maj7sus4`,
  `maj7sus2sus4`, `maj7sus4#5`
- extended: `add9`, `madd9`, `9`, `maj9`, `m9`, `mmaj9`, `9b5`, `aug9` (`C+9`), `augmaj9`, `7b9`, `7#9`,
  `7#9b5`, `9sus4`, `9#11`, `11`, `maj11`, `m11`, `mmaj11`, `maj#11` (`Cmaj7#11`), `13`, `maj13`,
  `m13`, `mmaj13`
- only from the chord database: `alt`, `7sg` (guitar), `7b9#5`, `m9b5`, `13b9`, `13b5b9`, `7b9b13`,
  `7#9b13` (ukulele)

`chordNames()` lists the chords that can be played: on a ukulele, many chords with five notes or with
a bass note can't.

### Voicings

The voicings of a chord start with those of the chord database, followed by the ones the plugin
finds: every combination of the chord's notes within four frets with the root (or the bass note) as
the lowest note, needing at most four fingers, ranked by how playable and complete it is. Generated
voicings are ordered from the nut up the neck, each shape once at its lowest position. On the
ukulele, the root can be left out of chords with four or more notes, and it doesn't have to be the
lowest note.

## Development

```bash
npm install
npm test        # tests with coverage
npm run lint
npm run build   # UMD + ES builds in dist/
```

The chord data in `src/data/` is generated from
[@tombatossals/chords-db](https://github.com/tombatossals/chords-db) with `npm run generate:chords`.
Voicings with notes that don't belong to the chord are left out, and chords the database only has for
some roots are added for the other roots by moving shapes without open strings along the neck. Each
voicing is stored as a short string (see `src/voicing.ts`) and converted to an SVGuitar chord when it
is drawn. The same script lists the chords that can't be played on an instrument.

The voicing generator (`src/voicing-generator.ts`) ranks voicings with weights fitted to the chord
shapes [jguitar.com](https://jguitar.com) lists, using the copy of them in
[T-vK/chord-collection](https://github.com/T-vK/chord-collection). `npm run train:voicings` downloads
it, fits the weights to `src/data/voicing-weights.json` and prints how well the generator matches
jguitar's choice for chord types it wasn't fitted on. Only the weights are part of the package.

The scripts need Node 24 or later, which runs TypeScript directly.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint).

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). Every push to
`main` updates a release PR with the next version and changelog. Merging that PR tags the release
and publishes the package to npm. Publishing needs an `NPM_TOKEN` repository secret.

## License

MIT

Chord data from [chords-db](https://github.com/tombatossals/chords-db) by David Rubert, MIT
licensed.
