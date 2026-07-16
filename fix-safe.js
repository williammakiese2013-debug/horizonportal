const fs = require('fs');

const file = 'ios/App/App/VRNativeBrowser.swift';
console.log("On ajoute la sécurité nécessaire sur evaluateJavaScript...");

try {
    let content = fs.readFileSync(file, 'utf8');

    // On transforme l'appel en mode "sécurisé" avec le ?
    content = content.replace(/customWebView\.evaluateJavaScript/g, 'customWebView?.evaluateJavaScript');

    fs.writeFileSync(file, content, 'utf8');
    console.log("-> C'est réparé !");
} catch (e) {
    console.error("Erreur :", e.message);
}