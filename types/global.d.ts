export {};

// Барои муоширати барнома бо wrapper-и React Native WebView (масалан
// юзоппи мобилӣ), ки ин глобалро дар window inject мекунад.
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}
