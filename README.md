# @svguitar/chords-plugin

[SVGuitar](https://github.com/omnibrain/svguitar) plugin to draw a chord diagram from a chord name like `C#`.

> **Work in progress:** the chord lookup is not implemented yet. `chordName()` currently draws an empty chord.

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

new SVGuitarWithChords('#chart').chordName('C#').draw()
```

## Development

```bash
npm install
npm test        # tests with coverage
npm run lint
npm run build   # UMD + ES builds in dist/
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint).

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). Every push to
`main` updates a release PR with the next version and changelog. Merging that PR tags the release
and publishes the package to npm. Publishing needs an `NPM_TOKEN` repository secret.

## License

MIT
