import { WebGLRenderer, SRGBColorSpace } from 'three';

/** True when the browser can create the WebGL2 context three.js needs. */
export function supportsWebGL(): boolean {
  if (new URLSearchParams(location.search).has('fallback')) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Creates a renderer, or returns null when the device cannot render the scene. */
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
  if (!supportsWebGL()) return null;
  try {
    const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    return renderer;
  } catch {
    return null;
  }
}
