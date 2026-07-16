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

// Injecté dans la page dès le début du chargement : prévient le JS (via
// webview-browser.js -> écouteur 'inputFocus') quand un champ éditable
// (input texte/recherche/email/url, textarea, contenteditable) prend ou
// perd le focus, pour afficher/masquer automatiquement le clavier
// virtuel — exactement comme le ferait le clavier système iOS, sauf que
// la WKWebView ici est headless (jamais affichée), donc pas de clavier
// natif possible : on le remplace entièrement côté VR.
private let horizonKeyboardFocusScript = """
(function(){
  function isEditable(el){
    if(!el) return false;
    if(el.isContentEditable) return true;
    var tag = el.tagName;
    if(tag === 'TEXTAREA') return true;
    if(tag === 'INPUT'){
      var t = (el.getAttribute('type')||'text').toLowerCase();
      return ['text','search','email','url','tel','password','number'].indexOf(t) !== -1;
    }
    return false;
  }
  document.addEventListener('focusin', function(e){
    if (isEditable(e.target)) {
      window.webkit.messageHandlers.horizonKeyboard.postMessage({
        focused: true,
        value: ('value' in e.target ? e.target.value : (e.target.innerText || ''))
      });
    }
  }, true);
  document.addEventListener('focusout', function(e){
    if (isEditable(e.target)) {
      window.webkit.messageHandlers.horizonKeyboard.postMessage({ focused: false });
    }
  }, true);
})();
"""

@objc(WebViewTexturePlugin)
public class WebViewTexturePlugin: CAPPlugin, WKNavigationDelegate, WKScriptMessageHandler {

    private var customWebView: WKWebView?
    private var containerView: UIView?
    private var displayLink: CADisplayLink?

    private var targetFPS: Double = 8
    private var lastCaptureTime: CFTimeInterval = 0
    private var jpegQuality: CGFloat = 0.6
    private var isCapturing = false
    private var captureInFlight = false
    private var pageDidFinishLoad = false

    // MARK: - Méthodes exposées au JS

    @objc func load(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
        let width = CGFloat(call.getDouble("width") ?? 1024)
        let height = CGFloat(call.getDouble("height") ?? 672)
        targetFPS = max(1, call.getDouble("fps") ?? 8)
        jpegQuality = max(0.1, min(CGFloat(call.getDouble("quality") ?? 0.6), 1.0))

        DispatchQueue.main.async { [weak self] in
            self?.setupWebView(url: url, width: width, height: height)
            call.resolve()
        }
    }

    @objc func tap(_ call: CAPPluginCall) {
        guard let webView = customWebView else { call.reject("No active webview. Call load() first."); return }
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
        guard let webView = customWebView else { call.reject("No active webview. Call load() first."); return }
        let dx = call.getDouble("dx") ?? 0
        let dy = call.getDouble("dy") ?? 0
        let js = "window.scrollBy({ left: \(dx), top: \(dy), behavior: 'auto' });"
        DispatchQueue.main.async { webView.evaluateJavaScript(js, completionHandler: nil) }
        call.resolve()
    }

    // Saisie clavier virtuel -> champ actuellement focus (activeElement) dans
    // la WKWebView cachée. Pas d'API publique pour injecter de vraies touches
    // clavier système dans une WKWebView externe, donc on manipule le champ
    // directement en JS (valeur + curseur + événement 'input' pour que les
    // frameworks JS des sites, ex. les suggestions Google, réagissent).
    @objc func typeText(_ call: CAPPluginCall) {
        guard let webView = customWebView else { call.reject("No active webview. Call load() first."); return }
        guard let text = call.getString("text") else { call.reject("Missing 'text'"); return }
        let escaped = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
        let js = """
        (function(){
          var el = document.activeElement;
          if (!el) return;
          var t = '\(escaped)';
          if (el.isContentEditable) {
            document.execCommand('insertText', false, t);
          } else if ('value' in el) {
            var start = (el.selectionStart != null) ? el.selectionStart : el.value.length;
            var end = (el.selectionEnd != null) ? el.selectionEnd : el.value.length;
            var val = el.value;
            el.value = val.slice(0, start) + t + val.slice(end);
            var pos = start + t.length;
            if (el.setSelectionRange) el.setSelectionRange(pos, pos);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })();
        """
        DispatchQueue.main.async { webView.evaluateJavaScript(js, completionHandler: nil) }
        call.resolve()
    }

    // Actions spéciales du clavier virtuel : effacer / entrée (validation
    // recherche ou formulaire) / espace.
    @objc func keyAction(_ call: CAPPluginCall) {
        guard let webView = customWebView else { call.reject("No active webview. Call load() first."); return }
        let action = call.getString("action") ?? ""
        var js = ""
        switch action {
        case "backspace":
            js = """
            (function(){
              var el = document.activeElement; if (!el) return;
              if (el.isContentEditable) { document.execCommand('delete', false); return; }
              if (!('value' in el)) return;
              var start = (el.selectionStart != null) ? el.selectionStart : el.value.length;
              var end = (el.selectionEnd != null) ? el.selectionEnd : el.value.length;
              var val = el.value;
              if (start === end) { if (start > 0) { val = val.slice(0, start - 1) + val.slice(end); start -= 1; } }
              else { val = val.slice(0, start) + val.slice(end); }
              el.value = val;
              if (el.setSelectionRange) el.setSelectionRange(start, start);
              el.dispatchEvent(new Event('input', { bubbles: true }));
            })();
            """
        case "enter":
            js = """
            (function(){
              var el = document.activeElement; if (!el) return;
              var down = new KeyboardEvent('keydown', { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true });
              var up = new KeyboardEvent('keyup', { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true });
              el.dispatchEvent(down);
              el.dispatchEvent(up);
              if (el.form && typeof el.form.requestSubmit === 'function') {
                try { el.form.requestSubmit(); } catch(e) {}
              }
            })();
            """
        case "space":
            js = "document.execCommand('insertText', false, ' ');"
        default:
            break
        }
        if js.isEmpty { call.resolve(); return }
        DispatchQueue.main.async { webView.evaluateJavaScript(js, completionHandler: nil) }
        call.resolve()
    }

    @objc func goBack(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in self?.customWebView?.goBack(); call.resolve() }
    }

    @objc func goForward(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in self?.customWebView?.goForward(); call.resolve() }
    }

    @objc func reload(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in self?.customWebView?.reload(); call.resolve() }
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

        // IMPORTANT (corrige l'écran noir) : takeSnapshot() ne rend de
        // façon fiable QUE les vues qui font réellement partie de la
        // passe de composition de la fenêtre. Une vue positionnée
        // entièrement hors des limites de la fenêtre (l'ancien
        // `x: -width - 100`) est souvent traitée comme non visible par
        // UIKit et produit une capture noire/vide, même si elle est
        // techniquement "attachée". On garde donc le conteneur DANS les
        // limites visibles de la fenêtre (coin supérieur gauche), mais on
        // le rend invisible autrement : alpha quasi nul + envoyé tout au
        // fond de la pile de vues (sous le contenu Capacitor normal) +
        // interactions désactivées.
        let container = UIView(frame: CGRect(x: 0, y: 0, width: width, height: height))
        container.alpha = 0.011
        container.isUserInteractionEnabled = false
        container.clipsToBounds = true
        container.isOpaque = true
        container.backgroundColor = .white

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        let contentController = WKUserContentController()
        contentController.add(self, name: "horizonKeyboard")
        let focusScript = WKUserScript(source: horizonKeyboardFocusScript,
                                        injectionTime: .atDocumentStart,
                                        forMainFrameOnly: false)
        contentController.addUserScript(focusScript)
        config.userContentController = contentController

        let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: height), configuration: config)
        wv.navigationDelegate = self
        wv.scrollView.isScrollEnabled = true
        wv.scrollView.bounces = false
        wv.isOpaque = true
        wv.backgroundColor = .white

        container.addSubview(wv)
        rootView.insertSubview(container, at: 0)
        self.containerView = container
        self.customWebView = wv
        self.pageDidFinishLoad = false

        wv.load(URLRequest(url: url))
        startCaptureLoop()
    }

    private func teardown() {
        stopCaptureLoop()
        customWebView?.stopLoading()
        customWebView?.navigationDelegate = nil
        customWebView?.configuration.userContentController.removeScriptMessageHandler(forName: "horizonKeyboard")
        customWebView?.removeFromSuperview()
        containerView?.removeFromSuperview()
        customWebView = nil
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
        guard isCapturing, !captureInFlight, let webView = customWebView, pageDidFinishLoad else { return }
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

    // MARK: - WKScriptMessageHandler
    // Relaie vers le JS (webview-browser.js) le focus/blur des champs de la
    // page, pour que le clavier virtuel VR s'affiche/se masque tout seul.
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        notifyListeners("inputFocus", data: body)
    }

    // MARK: - WKNavigationDelegate

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageDidFinishLoad = true
        notifyListeners("loadFinished", data: ["url": webView.url?.absoluteString ?? ""])
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        notifyListeners("loadError", data: ["message": error.localizedDescription])
    }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        notifyListeners("loadError", data: ["message": error.localizedDescription])
    }
}
