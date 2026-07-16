const fs = require('fs');

const file = 'ios/App/App/VRNativeBrowser.swift';

try {
    let content = fs.readFileSync(file, 'utf8');

    // 1. On renomme la classe dupliquée pour stopper le conflit
    content = content.replace(/class\s+WebViewTexturePlugin/g, 'class VRNativeBrowser');
    content = content.replace(/@objc\(WebViewTexturePlugin\)/g, '@objc(VRNativeBrowser)');

    // 2. On supprime la variable "vrWebView" qui ne sert plus à rien et on utilise la globale
    content = content.replace(/let\s+vrWebView\s*=\s*webView/g, 'customWebView != nil');
    content = content.replace(/let\s+vrWebView\s*=\s*customWebView/g, 'customWebView != nil');
    
    // 3. On remplace les derniers restes de vrWebView par customWebView
    content = content.replace(/\bvrWebView!\./g, 'customWebView!.');
    content = content.replace(/\bvrWebView\?\./g, 'customWebView?.');
    content = content.replace(/\bvrWebView\b/g, 'customWebView');

    fs.writeFileSync(file, content, 'utf8');
    console.log("-> Le fichier VRNativeBrowser.swift a été renommé et nettoyé !");
} catch (e) {
    console.error("Erreur :", e.message);
}