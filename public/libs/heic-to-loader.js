import { heicTo, isHeic } from './heic-to-csp.min.js';
window.HeicTo = { heicTo, isHeic };
window.dispatchEvent(new Event('heic-to-ready'));
