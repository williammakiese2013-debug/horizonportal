const { execSync } = require('child_process');
const fs = require('fs');

const files = [
    'ios/App/App/VRNativeBrowser.swift',
    'ios/App/App/WebViewTexturePlugin.swift'
];

console.log("Restauration des fichiers originaux avec Git...");
files.forEach(file => {
    try {
        // On force la restauration pour effacer les modifs des scripts précédents
        execSync(`git checkout HEAD -- "${file}"`, { stdio: 'inherit' });
        console.log(`-> ${file} a été remis à neuf.`);
    } catch (e) {
        console.log(`Note : Impossible de restaurer ${file} avec Git, on continue...`);
    }
});

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.error(`Erreur : Le fichier ${filePath} est introuvable.`);
        return;
    }

    console.log(`\nApplication du correctif chirurgical sur ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. On renomme uniquement la variable globale de la classe
    content = content.replace(/private\s+var\s+webView/g, 'private var customWebView');

    // 2. On renomme les accès avec "self.webView"
    content = content.replace(/self\.webView/g, 'self.customWebView');

    // 3. On renomme l'unwrapping local (ex: let webView = webView -> let webView = customWebView)
    content = content.replace(/(let\s+webView\s*=\s*)webView\b/g, '$1customWebView');

    // 4. On renomme "webView?" (accès optionnel)
    content = content.replace(/\bwebView\?/g, 'customWebView?');

    // 5. On renomme "webView!" (accès forcé)
    content = content.replace(/\bwebView!/g, 'customWebView!');

    // 6. On renomme "webView =" (les affectations globales, sans toucher aux let/var/guard)
    content = content.replace(/(?<!\b(?:let|var|guard|if)\s+)\bwebView\s*=/g, 'customWebView =');

    // 7. On renomme les comparaisons d'égalité
    content = content.replace(/\bwebView\s*==/g, 'customWebView ==');
    content = content.replace(/\bwebView\s*!=/g, 'customWebView !=');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`-> ${filePath} est maintenant corrigé et propre !`);
});

console.log("\nParfait ! Tout est prêt.");