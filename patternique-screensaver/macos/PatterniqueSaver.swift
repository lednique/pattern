import ScreenSaver
import WebKit

/// Patternique screensaver: hosts the animated pattern background
/// (screensaver.html from Contents/Resources) in a WKWebView.
/// The HTML is fully offline — patterns are generated locally in JS.
@objc(PatterniqueSaverView)
public class PatterniqueSaverView: ScreenSaverView {

    private var webView: WKWebView?

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        setup()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor

        let configuration = WKWebViewConfiguration()
        configuration.suppressesIncrementalRendering = false

        let web = WKWebView(frame: bounds, configuration: configuration)
        web.autoresizingMask = [.width, .height]
        // Keep the web view transparent until the page paints its own color.
        web.setValue(false, forKey: "drawsBackground")
        addSubview(web)
        webView = web

        if let url = Bundle(for: type(of: self)).url(forResource: "screensaver", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }

    // The page animates itself with CSS transitions; no per-frame drawing needed.
    public override func animateOneFrame() {}

    public override var hasConfigureSheet: Bool { false }
    public override var configureSheet: NSWindow? { nil }
}
