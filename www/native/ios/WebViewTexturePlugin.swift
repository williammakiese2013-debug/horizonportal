//
//  WebViewTexturePlugin.swift
//  ------------------------------------------------------------
//  Remplace VRNativeBrowser.swift (superposition 2D d'une WKWebView
//  par-dessus l'écran). Ici la page n'est jamais affichée directement :
//  on rend une WKWebView cachée hors-écran, on capture son buffer via
//  takeSnapshot(), et on transmet chaque frame (JPEG base64) au JS
//  (js/vr-interactions/webview-browser.js), qui la peint dans un
//  <canvas> -> THREE.CanvasTexture appliqué à un <a-plane> RÉEL dans la
//  scène 3D (un par œil), donc world-locked et rendu en stéréo.
//
//  INSTALLATION (Capacitor)
//  1. Glisse ce fichier + WebViewTexturePlugin.m dans ton projet Xcode
//     (cible App, dossier ios/App/App par exemple).
//  2. `npx cap sync ios` (ou reconstruire dans Xcode) pour que Capacitor
//     enregistre le plugin natif "WebViewTexture".
//  3. Côté JS, il est déjà exposé automatiquement sur
//     window.Capacitor.Plugins.WebViewTexture — rien d'autre à faire,
//     webview-browser.js le détecte et l'utilise tout seul.
//
//  NOTE : WKWebView n'expose pas de handle GPU/texture public (pas
//  d'IOSurface public), donc ceci n'est pas du "zero-copy" ; c'est du
//  polling via l'API supportée takeSnapshot(), ~8-15 fps en JPEG selon
//  résolution/qualité — largement suffisant pour naviguer, pas pour de
//  la vidéo fluide à l'intérieur de la page.
//  ------------------------------------------------------------

import Foundation
import UIKit
import WebKit
import Capacitor

@objc(WebViewTexturePlugin)
public class WebViewTexturePlugin: CAPPlugin, WKNavigationDelegate {

    private var webView: WKWebView?
    private var containerView: UIView?
    private var displayLink: CADisplayLink?

    private var targetFPS: Double = 8
    private var lastCaptureTime: CFTimeInterval = 0
    private var jpegQuality: CGFloat = 0.6
    private var isCapturing = false
    private var captureInFlight = false

    // MARK: - Méthodes exposées au JS

    @objc func load(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
        let width = CGFloat(call.getDouble("width") ?? 1024)
        let height = CGFloat(call.getDouble("height") ?? 672)
        targetFPS = max(1, call.getDouble("fps") ?? 8)
        jpegQuality = max(0.1, min(CGFloat(call.getFloat("quality") ?? 0.6), 1.0))

        DispatchQueue.main.async { [weak self] in
            self?.setupWebView(url: url, width: width, height: height)
            call.resolve()
        }
    }

    @objc func tap(_ call: CAPPluginCall) {
        guard let webView = webView else { call.reject("No active webview. Call load() first."); return }
        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        // Pas d'injection UITouch système possible dans une WKWebView externe
        // (pas d'API publique) : on simule un clic DOM sous le point, ce qui
        // couvre liens/boutons/formulaires sur l'immense majorité des sites.
        let js = """
        (function() {
            var el = document.elementFromPoint(\(x), \(y));
            if (!el) return;
            var opts = { bubbles: true, cancelable: true, clientX: \(x), clientY: \(y), view: window };
            el.dispatchEvent(new MouseEvent('mouseover', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            if (typeof el.focus === 'function') { el.focus(); }
        })();
        """
        DispatchQueue.main.async { webView.evaluateJavaScript(js, completionHandler: nil) }
        call.resolve()
    }

    @objc func scrollBy(_ call: CAPPluginCall) {
        guard let webView = webView else { call.reject("No active webview. Call load() first."); return }
        let dx = call.getDouble("dx") ?? 0
        let dy = call.getDouble("dy") ?? 0
        let js = "window.scrollBy({ left: \(dx), top: \(dy), behavior: 'auto' });"
        DispatchQueue.main.async { webView.evaluateJavaScript(js, completionHandler: nil) }
        call.resolve()
    }

    @objc func setFPS(_ call: CAPPluginCall) {
        targetFPS = max(1, call.getDouble("fps") ?? targetFPS)
        call.resolve()
    }

    @objc func destroy(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.teardown()
            call.resolve()
        }
    }

    // MARK: - Cycle de vie de la WKWebView cachée

    private func setupWebView(url: URL, width: CGFloat, height: CGFloat) {
        teardown()
        guard let rootView = self.bridge?.viewController?.view else { return }

        // La WKWebView doit rester dans une hiérarchie de vues vivante pour se
        // layouter/rendre correctement -> on la garde attachée mais poussée
        // hors écran et rendue fonctionnellement invisible/non-interactive.
        let container = UIView(frame: CGRect(x: -width - 100, y: 0, width: width, height: height))
        container.alpha = 0.01
        container.isUserInteractionEnabled = false
        container.clipsToBounds = true

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: height), configuration: config)
        wv.navigationDelegate = self
        wv.scrollView.isScrollEnabled = true
        wv.scrollView.bounces = false

        container.addSubview(wv)
        rootView.addSubview(container)
        self.containerView = container
        self.webView = wv

        wv.load(URLRequest(url: url))
        startCaptureLoop()
    }

    private func teardown() {
        stopCaptureLoop()
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        containerView?.removeFromSuperview()
        webView = nil
        containerView = nil
    }

    // MARK: - Boucle de capture

    private func startCaptureLoop() {
        stopCaptureLoop()
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.add(to: .main, forMode: .common)
        displayLink = link
        isCapturing = true
    }

    private func stopCaptureLoop() {
        displayLink?.invalidate()
        displayLink = nil
        isCapturing = false
    }

    @objc private func tick(_ link: CADisplayLink) {
        guard isCapturing, !captureInFlight, let webView = webView else { return }
        let interval = 1.0 / targetFPS
        if link.timestamp - lastCaptureTime < interval { return }
        lastCaptureTime = link.timestamp
        captureFrame(webView)
    }

    private func captureFrame(_ webView: WKWebView) {
        captureInFlight = true
        let config = WKSnapshotConfiguration()
        config.rect = webView.bounds
        webView.takeSnapshot(with: config) { [weak self] image, error in
            guard let self = self else { return }
            self.captureInFlight = false
            guard let image = image, error == nil else { return }
            guard let jpeg = image.jpegData(compressionQuality: self.jpegQuality) else { return }
            self.notifyListeners("frameUpdate", data: [
                "image": jpeg.base64EncodedString(),
                "width": image.size.width,
                "height": image.size.height,
                "timestamp": Date().timeIntervalSince1970
            ])
        }
    }

    // MARK: - WKNavigationDelegate

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        notifyListeners("loadFinished", data: ["url": webView.url?.absoluteString ?? ""])
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        notifyListeners("loadError", data: ["message": error.localizedDescription])
    }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        notifyListeners("loadError", data: ["message": error.localizedDescription])
    }
}
