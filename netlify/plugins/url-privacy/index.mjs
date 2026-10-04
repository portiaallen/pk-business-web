import { hardenNetlifyArtifact } from '../../../scripts/harden-netlify-artifact.mjs';
/** Must execute after the pinned Next adapter; unknown generated wrapper fails the build. */
export function onBuild() {
  hardenNetlifyArtifact('.netlify/functions-internal/___netlify-server-handler/___netlify-server-handler.mjs');
}
