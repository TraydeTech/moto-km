// Copia os arquivos do site para www/, que é a pasta que o Capacitor coloca dentro do app iOS.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-512.png', 'apple-touch-icon.png'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`);
console.log(`www/ pronto (${FILES.length} arquivos)`);
