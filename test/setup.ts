// svguitar needs a DOM to render. Provide one with svgdom before svguitar is imported.
import { createSVGWindow } from 'svgdom'

const window = createSVGWindow()
Object.assign(globalThis, { window, document: window.document })
