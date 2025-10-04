/* Polyfills required by @tensorflow/tfjs on React Native.
 * Some TensorFlow helpers expect navigator.userAgent to be a string
 * and will call string methods like .includes during module init.
 */

const globalAny = globalThis as unknown as { navigator?: { userAgent?: unknown } };

if (!globalAny.navigator) {
  globalAny.navigator = {};
}

if (typeof globalAny.navigator.userAgent !== 'string') {
  globalAny.navigator.userAgent = 'ReactNative';
}
