"use strict";

importScripts(
  "/lib/polyfill.js",
  "/lib/xhrPolyfill.js",
  "/lib/checkedLastError.js",
  "/lib/stuff.js",
  "/lib/languages.js",
  "/lib/config.js",
  "/lib/platformInfo.js",
  "/lib/i18n.js",
  "/background/translationCache.js",
  "/background/translationService.js",
  "/background/background.js"
);

// Text-to-speech needs `Audio`/`AudioContext`, which don't exist in a service
// worker, so it runs in an offscreen document instead. Keep it alive so the
// "textToSpeech"/"stopAudio" messages (broadcast via chrome.runtime.sendMessage)
// always have a listener.
async function ensureOffscreenDocumentForTextToSpeech() {
  if (!chrome.offscreen) return;
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: "/offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play text-to-speech audio, which requires the Audio/AudioContext APIs that service workers don't have."
    });
  } catch (e) {
    // Ignore races where another event created the document first.
    console.error(e);
  }
}
chrome.runtime.onInstalled.addListener(() => ensureOffscreenDocumentForTextToSpeech());
chrome.runtime.onStartup.addListener(() => ensureOffscreenDocumentForTextToSpeech());
ensureOffscreenDocumentForTextToSpeech();
