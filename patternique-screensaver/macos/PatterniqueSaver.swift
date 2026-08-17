import ScreenSaver
import WebKit

/// Patternique screensaver: hosts the animated pattern background
/// (screensaver.html from Contents/Resources) in a WKWebView.
/// The HTML is fully offline — patterns are generated locally in JS.
///
/// Notes for the sandboxed legacyScreenSaver host (macOS 10.15+):
/// - The page is injected with loadHTMLString instead of loadFileURL: the
///   WebContent helper process may be denied access to file:// URLs inside
///   the screensaver sandbox, which renders as a plain black screen.
/// - No private API (drawsBackground KVC) is used: an exception thrown by
///   key-value coding inside the appex also ends in a black screen.
@objc(PatterniqueSaverView)
public class PatterniqueSaverView: ScreenSaverView, WKNavigationDelegate {

    private var webView: WKWebView?
    private var statusLabel: NSTextField?

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0 / 30.0
        setup()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0 / 30.0
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor(red: 5.0 / 255.0, green: 7.0 / 255.0, blue: 8.0 / 255.0, alpha: 1).cgColor

        let configuration = WKWebViewConfiguration()
        configuration.suppressesIncrementalRendering = false
        if #available(macOS 11.0, *) {
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        }

        let web = WKWebView(frame: bounds, configuration: configuration)
        web.navigationDelegate = self
        web.autoresizingMask = [.width, .height]
        addSubview(web)
        webView = web

        loadPage()
    }

    private func loadPage() {
        let bundle = Bundle(for: type(of: self))
        guard let url = bundle.url(forResource: "screensaver", withExtension: "html") else {
            showStatus("Patternique: screensaver.html is missing from the bundle resources.")
            return
        }
        guard let html = try? String(contentsOf: url, encoding: .utf8) else {
            showStatus("Patternique: screensaver.html could not be read.")
            return
        }
        // The page is fully self-contained, so a nil base URL is enough and
        // sidesteps every file-access restriction of the saver sandbox.
        webView?.loadHTMLString(html, baseURL: nil)
    }

    /// Visible diagnostics instead of a silent black screen.
    private func showStatus(_ message: String) {
        statusLabel?.removeFromSuperview()
        let label = NSTextField(labelWithString: message)
        label.textColor = .white
        label.font = NSFont.systemFont(ofSize: isPreview ? 9 : 16)
        label.alignment = .center
        label.frame = bounds.insetBy(dx: 20, dy: bounds.height / 2 - 30)
        label.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        addSubview(label)
        statusLabel = label
    }

    // MARK: - WKNavigationDelegate

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showStatus("Patternique: page failed to load — \(error.localizedDescription)")
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showStatus("Patternique: page failed to start — \(error.localizedDescription)")
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The WebContent helper was killed (memory pressure, sandbox):
        // reload instead of leaving a black screen.
        loadPage()
    }

    // The page animates itself with CSS transitions; no per-frame drawing needed.
    public override func animateOneFrame() {}

    public override var hasConfigureSheet: Bool { false }
    public override var configureSheet: NSWindow? { nil }
}
