// narrator.js
// Voix narrative du mode histoire, basée sur l'API Web Speech (SpeechSynthesis)
// du navigateur : aucune ressource audio à charger, tout est généré en direct.
// Si le navigateur ne supporte pas la synthèse vocale, on retombe simplement
// sur un simple minuteur pour laisser le temps de lire les sous-titres.

export function createNarrator() {
  const synth = window.speechSynthesis || null;
  let frenchVoice = null;

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    frenchVoice =
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('fr')) ||
      voices[0] ||
      null;
  }

  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice;
  }

  // Prononce une ligne et résout la promesse quand c'est terminé (ou si
  // `skipSignal.skipped` passe à true entre-temps).
  function speak(text, skipSignal) {
    return new Promise((resolve) => {
      if (skipSignal && skipSignal.skipped) {
        resolve();
        return;
      }

      if (!synth) {
        // Pas de synthèse vocale disponible : on estime un temps de lecture.
        const estimatedMs = Math.max(1600, text.length * 55);
        const start = performance.now();
        const poll = () => {
          if ((skipSignal && skipSignal.skipped) || performance.now() - start > estimatedMs) {
            resolve();
          } else {
            requestAnimationFrame(poll);
          }
        };
        poll();
        return;
      }

      try {
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        if (frenchVoice) utter.voice = frenchVoice;
        utter.lang = 'fr-FR';
        utter.rate = 0.98;
        utter.pitch = 0.92;
        utter.volume = 1;

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        utter.onend = finish;
        utter.onerror = finish;

        if (skipSignal) {
          const checkSkip = () => {
            if (done) return;
            if (skipSignal.skipped) {
              synth.cancel();
              finish();
            } else {
              requestAnimationFrame(checkSkip);
            }
          };
          checkSkip();
        }

        synth.speak(utter);
      } catch (err) {
        const estimatedMs = Math.max(1600, text.length * 55);
        setTimeout(resolve, estimatedMs);
      }
    });
  }

  function stop() {
    if (synth) synth.cancel();
  }

  return { speak, stop };
}
