const fs = require('fs');
const path = 'ios/App/App/VRNativeBrowser.swift';

if (!fs.existsSync(path)) {
    console.error("Erreur : Impossible de trouver le fichier VRNativeBrowser.swift.");
    console.error("Es-tu bien dans le dossier horizon-vr-portal-library-update (12) ?");
    process.exit(1);
}

let content = fs.readFileSync(path, 'utf8');

// On remplace proprement la variable locale pour éviter le conflit avec Capacitor
const updatedContent = content
  .replace(/private var webView/g, 'private var vrWebView')
  .replace(/self\.webView/g, 'self.vrWebView')
  .replace(/\bwebView\./g, 'vrWebView.')
  .replace(/\bwebView\s*=/g, 'vrWebView =')
  .replace(/let webView = webView/g, 'let webView = vrWebView')
  .replace(/let webView = self\.webView/g, 'let webView = self.vrWebView')
  .replace(/\bwebView\?/g, 'vrWebView?');

fs.writeFileSync(path, updatedContent, 'utf8');
console.log("Félicitations ! Le fichier VRNativeBrowser.swift a été corrigé avec succès.");