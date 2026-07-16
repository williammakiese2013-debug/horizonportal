const fs = require('fs');
const file = 'ios/App/App/Info.plist';

console.log("Mise à jour des autorisations dans Info.plist...");

let content = fs.readFileSync(file, 'utf8');

// 1. Ajout de la Caméra
if (!content.includes('NSCameraUsageDescription')) {
    content = content.replace('<dict>', `<dict>
    <key>NSCameraUsageDescription</key>
    <string>Accès caméra requis pour le suivi des mains VR.</string>`);
}

// 2. Ajout du support WebView
if (!content.includes('NSAppTransportSecurity')) {
    content = content.replace('</dict>', `
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
</dict>`);
}

fs.writeFileSync(file, content, 'utf8');
console.log("-> Autorisations ajoutées avec succès !");