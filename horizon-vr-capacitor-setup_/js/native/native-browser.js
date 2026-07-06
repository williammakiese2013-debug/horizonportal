// Wrapper pour le plugin @capacitor/browser
// Permet d'ouvrir des liens dans un navigateur natif intégré (in-app browser)
// au lieu de quitter l'application Horizon VR Portal.

import { Browser } from '@capacitor/browser';

/**
 * Ouvre une URL dans le navigateur natif intégré (in-app).
 * @param {string} url - L'URL à ouvrir
 * @param {object} options - Options additionnelles (couleur toolbar, etc.)
 */
export async function openInternalBrowser(url, options = {}) {
  await Browser.open({
    url,
    presentationStyle: 'fullscreen',
    toolbarColor: options.toolbarColor || '#000000',
    ...options
  });
}

/**
 * Ferme le navigateur natif intégré s'il est ouvert.
 */
export async function closeInternalBrowser() {
  await Browser.close();
}

// Écoute optionnelle des événements du navigateur natif
Browser.addListener('browserFinished', () => {
  console.log('[NativeBrowser] Fermé par l’utilisateur');
});

Browser.addListener('browserPageLoaded', () => {
  console.log('[NativeBrowser] Page chargée');
});
