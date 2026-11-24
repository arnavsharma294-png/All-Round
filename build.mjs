import { readFile, mkdir, writeFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const fonts = [
  ['dm', 'DM Sans', 'normal', '100 1000'],
  ['mono', 'IBM Plex Mono', 'normal', '400'],
  ['serif', 'Instrument Serif', 'normal', '400'],
  ['serif-italic', 'Instrument Serif', 'italic', '400']
];
const fontFaces = await Promise.all(fonts.map(async ([file, family, style, weight]) => {
  const bytes = await readFile(new URL('src/fonts/' + file + '.woff2', import.meta.url));
  return "@font-face{font-family:'" + family + "';font-style:" + style + ";font-weight:" + weight
    + ";font-display:swap;src:url(data:font/woff2;base64," + bytes.toString('base64') + ") format('woff2')}";
}));
const [template, css, scene, app] = await Promise.all(
  ['src/index.html', 'src/styles.css', 'src/scene.js', 'src/app.js'].map(read)
);
const licenses = await Promise.all(
  ['dmsans', 'ibmplexmono', 'instrumentserif'].map(name => read('src/fonts/licenses/' + name + '.txt'))
);
const output = template
  .replace('/* STYLES */', () => css.replace('/* FONTS */', fontFaces.join('\n')))
  .replace('/* SCENE */', () => scene)
  .replace('/* APP */', () => app)
  .replace('</body>', () => '<!--\n' + licenses.join('\n\n') + '\n-->\n</body>');
await mkdir(new URL('dist', import.meta.url), { recursive: true });
await writeFile(new URL('dist/index.html', import.meta.url), output);
