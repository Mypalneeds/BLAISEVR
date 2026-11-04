// BlaiseVR — runs the AO bake off the main thread so the app never freezes.
import { bakeAO } from './ao.js';
self.onmessage = e => {
  const { id, pos, nor, N } = e.data;
  const ao = bakeAO(pos, nor, N);
  self.postMessage({ id, ao }, [ao.buffer]);
};
