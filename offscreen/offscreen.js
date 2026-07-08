"use strict";

// Plays text-to-speech audio on behalf of background/textToSpeech.js, which
// runs in the service worker and has no access to Audio/AudioContext.
class AudioAmplifier {
  constructor() {
    /** @type {MediaElementAudioSourceNode[]} */
    this.sources = [];
    if (typeof AudioContext !== "undefined") {
      this.audioCtx = new AudioContext();
      this.audioCtx.suspend();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1;
      this.gainNode.connect(this.audioCtx.destination);
    }
  }

  /**
   * @param {HTMLAudioElement} audio
   */
  async amplify(audio) {
    if (!this.audioCtx) return;
    if (this.sources.find(source => source.mediaElement === audio)) {
      await this.audioCtx.resume();
      return;
    }
    const source = this.audioCtx.createMediaElementSource(audio);
    this.sources.push(source);
    source.connect(this.gainNode);
    await this.audioCtx.resume();
  }

  /**
   * @param {number} volume
   */
  setVolume(volume) {
    if (!this.gainNode) return;
    this.gainNode.gain.value = volume > 1 ? volume : 1;
  }

  async suspend() {
    if (this.audioCtx) {
      await this.audioCtx.suspend();
    }
  }
}

const audioAmplifier = new AudioAmplifier();
/** @type {HTMLAudioElement[]} */
let activeAudios = [];
let audioSpeed = 1;
let audioVolume = 1;

function applyVolume(audio) {
  audio.volume = audioVolume > 1 ? 1 : audioVolume;
}

function stopAll() {
  activeAudios.forEach(audio => {
    audio.pause();
    // If `currentTime` is not `duration` an audio stream will remain active in Firefox
    // https://github.com/FilipePS/Traduzir-paginas-web/issues/802
    if (!isNaN(audio.duration) && isFinite(audio.duration)) {
      audio.currentTime = audio.duration;
    }
  });
  audioAmplifier.suspend();
}

/**
 * Plays each data URL in `audioUrls`, one after another.
 * @param {string[]} audioUrls
 * @returns {Promise<void>}
 */
async function playSequence(audioUrls) {
  stopAll();
  activeAudios = audioUrls.map(url => new Audio(url));
  audioAmplifier.setVolume(audioVolume < 1 ? 1 : audioVolume);
  await new Promise(resolve => {
    const playAt = async index => {
      const audio = activeAudios[index];
      if (!audio) {
        resolve();
        return;
      }
      try {
        audio.playbackRate = audioSpeed;
        applyVolume(audio);
        await audioAmplifier.amplify(audio);
        audio.play();
        audio.addEventListener("ended", () => playAt(index + 1), {
          once: true
        });
      } catch (e) {
        console.error(e);
        resolve();
      }
    };
    playAt(0);
  });
  await audioAmplifier.suspend();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "offscreenPlayAudio") {
    audioSpeed = request.speed || 1;
    audioVolume = request.volume || 1;
    playSequence(request.audioUrls).finally(() => sendResponse());
    return true;
  } else if (request.action === "offscreenStopAudio") {
    stopAll();
  } else if (request.action === "offscreenSetAudioSpeed") {
    audioSpeed = request.speed;
    activeAudios.forEach(audio => {
      audio.playbackRate = audioSpeed;
    });
  } else if (request.action === "offscreenSetAudioVolume") {
    audioVolume = request.volume;
    activeAudios.forEach(applyVolume);
    audioAmplifier.setVolume(audioVolume < 1 ? 1 : audioVolume);
  }
});
