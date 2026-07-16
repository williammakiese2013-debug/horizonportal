const { execSync } = require('child_process');
const fs = require('fs');

console.log("1. Restauration de la version originale de VRNativeBrowser.swift...");
try {
    // On annule le script cassé de la dernière fois pour repartir sur du propre
    execSync('git checkout HEAD~1 -- ios/App/App/VRNativeBrowser.swift', { stdio: 'inherit' });
    console.log("-> VRNativeBrowser.swift restauré !");
} catch (e) {
    console.log("Note : Impossible de restaurer avec git (déjà propre), on continue...");
}

const files = [
    'ios/App/App/VRNativeBrowser.swift',
    'ios/App/App/WebViewTexturePlugin.swift'
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.error(`Erreur : Le fichier ${filePath} n'existe pas.`);
        return;
    }

    console.log(`\nTraitement de ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Renommer la déclaration de la propriété de classe
    content = content.replace(/private\s+var\s+webView\s*:\s*WKWebView/g, 'private var customWebView: WKWebView');

    // 2. Renommer l'unwrapping local sans casser le reste du code
    content = content.replace(/let\s+webView\s*=\s*webView\b/g, 'let webView = customWebView');
    content = content.replace(/let\s+webView\s*=\s*self\.webView\b/g, 'let webView = self.customWebView');

    // 3. Renommer les accès optionnels de classe
    content = content.replace(/\bwebView\?(\b|\.)/g, 'customWebView?$1');

    // 4. Renommer les affectations globales
    content = content.replace(/\bself\.webView\s*=/g, 'self.customWebView =');
    content = content.replace(/\bwebView\s*=\s*/g, 'customWebView = ');

    // 5. Renommer les comparaisons
    content = content.replace(/\bwebView\s*==\s*/g, 'customWebView == ');
    content = content.replace(/\bwebView\s*!=\s*/g, 'customWebView != ');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`-> ${filePath} mis à jour avec succès !`);
});

console.log("\nTerminé ! Tous les conflits de webView ont été résolus proprement.");