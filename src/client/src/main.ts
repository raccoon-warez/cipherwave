// Bundled (offline, file://-safe) fonts — Chakra Petch (HUD display/labels) and
// Space Mono (call signs, codes, timestamps). Latin subset only to stay lean.
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles/app.css';

import { mount } from 'svelte';
import App from './App.svelte';

mount(App, {
  target: document.getElementById('app')!,
});
