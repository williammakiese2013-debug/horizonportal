const fs = require('fs');
const file = 'ios/App/App/VRNativeBrowser.swift';

console.log("On ajoute explicitement 'self.' pour satisfaire le compilateur...");

try {
    let content = fs.readFileSync(file, 'utf8');

    // On remplace les appels dans la DispatchQueue pour ajouter le self.
    // Cela cible spécifiquement les lignes qui bloquent
    content = content.replace(/DispatchQueue\.main\.async\s*\{\s*customWebView/g, 'DispatchQueue.main.async { self.customWebView');

    fs.writeFileSync(file, content, 'utf8');
    console.log("-> Modification appliquée avec succès !");
} catch (e) {
    console.error("Erreur :", e.message);
}