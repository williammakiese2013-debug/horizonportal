const fs = require('fs');

const filePath = 'ios/App/App/VRNativeBrowser.swift';
console.log("On ajoute les points d'exclamation (!) demandés par Xcode...");

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Ajouter le ! pour captureFrame
    content = content.replace(/captureFrame\(webView\)/g, 'captureFrame(webView!)');
    
    // 2. Ajouter le ! pour config.rect
    content = content.replace(/vrWebView\.bounds/g, 'vrWebView!.bounds');
    
    // 3. Ajouter le ! pour takeSnapshot
    content = content.replace(/vrWebView\.takeSnapshot/g, 'vrWebView!.takeSnapshot');
    
    // 4. Ajouter le ! pour l'URL
    content = content.replace(/vrWebView\.url/g, 'vrWebView!.url');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("-> C'est réparé !");
} catch (e) {
    console.error("Erreur :", e.message);
}