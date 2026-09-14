export {};

// For the app to communicate with the React Native WebView wrapper (e.g.
// the mobile app), which injects this global into window.
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}
