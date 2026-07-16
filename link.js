const { execSync } = require('child_process');
const fs = require('fs');

console.log("Préparation de l'outil de liaison...");
try {
    require.resolve('xcode');
} catch (e) {
    execSync('npm install xcode --no-save', { stdio: 'inherit' });
}

const xcode = require('xcode');
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';

if (!fs.existsSync(projectPath)) {
    console.error("Erreur : Fichier projet introuvable. Es-tu bien dans le dossier (12) ?");
    process.exit(1);
}

const proj = xcode.project(projectPath);

proj.parse(function (err) {
    if (err) {
        console.error("Erreur lors de la lecture du projet :", err);
        return;
    }

    const files = [
        'WebViewTexturePlugin.swift',
        'WebViewTexturePlugin.m',
        'VRNativeBrowser.swift'
    ];

    files.forEach(file => {
        proj.addSourceFile('App/' + file, null, 'App');
        console.log(`-> Fichier lié avec succès : ${file}`);
    });

    fs.writeFileSync(projectPath, proj.writeSync());
    console.log("\nFélicitations ! Le projet Xcode a été mis à jour.");
});