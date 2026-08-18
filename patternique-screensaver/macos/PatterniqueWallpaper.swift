import AppKit
import QuartzCore

/// Patternique Wallpaper — "Macintosh"-style live wallpaper.
///
/// A borderless window is placed at the desktop window level (behind the
/// desktop icons) on every screen and hosts the same Core Animation pattern
/// engine as the screensaver. The behavior mirrors macOS dynamic
/// screensaver-wallpapers such as "Macintosh":
///
/// - on login/launch the pattern builds up with its diagonal wave, then
///   settles and stays perfectly still (a static wallpaper);
/// - when the screen is locked, everything pauses;
/// - when the device is unlocked (or wakes from sleep), exactly one morph
///   wave plays — the old pattern melts into a fresh random one — and the
///   wallpaper freezes again.
///
/// Build & install: `make wallpaper-install` (see Makefile). The app is a
/// background agent (LSUIElement) with no Dock icon or menu bar.
@main
final class PatterniqueWallpaperApp: NSObject, NSApplicationDelegate {

    private var windows: [NSWindow] = []
    private var views: [PatterniqueSaverView] = []
    private var locked = false

    static func main() {
        let app = NSApplication.shared
        let delegate = PatterniqueWallpaperApp()
        app.delegate = delegate
        app.setActivationPolicy(.accessory) // no Dock icon, no menu bar
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildWindows()

        // Lock/unlock — the wallpaper pauses under the lock screen and plays
        // one transition right after unlocking, like the Macintosh wallpaper.
        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(self, selector: #selector(screenLocked),
                        name: NSNotification.Name("com.apple.screenIsLocked"), object: nil)
        dnc.addObserver(self, selector: #selector(screenUnlocked),
                        name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)

        // Waking from sleep also gets a single transition.
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(didWake),
            name: NSWorkspace.didWakeNotification, object: nil)

        // Rebuild when displays are added/removed or resolutions change.
        NotificationCenter.default.addObserver(
            self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    // MARK: - Desktop windows

    private func buildWindows() {
        windows.forEach { $0.orderOut(nil) }
        windows = []
        views = []

        for screen in NSScreen.screens {
            let window = NSWindow(contentRect: screen.frame,
                                  styleMask: .borderless,
                                  backing: .buffered,
                                  defer: false)
            window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            window.isOpaque = true
            window.hasShadow = false
            window.ignoresMouseEvents = true
            window.backgroundColor = NSColor(red: 5 / 255.0, green: 7 / 255.0, blue: 8 / 255.0, alpha: 1)

            guard let view = PatterniqueSaverView(frame: NSRect(origin: .zero, size: screen.frame.size),
                                                  isPreview: false) else { continue }
            view.autoCycles = false // wallpaper mode: no self-cycling
            window.contentView = view
            window.orderBack(nil)

            windows.append(window)
            views.append(view)

            // Initial build-up wave, then the pattern settles and stays still.
            view.startAnimation()
        }
    }

    // MARK: - Events

    @objc private func screenLocked() {
        locked = true
        // Nothing is animating between waves; just make sure timers are dead.
        views.forEach { if $0.isAnimating { $0.stopAnimation() } }
    }

    @objc private func screenUnlocked() {
        guard locked else { return }
        locked = false
        // One morph wave into a fresh pattern, then still again.
        views.forEach { $0.playOneTransition() }
    }

    @objc private func didWake() {
        // Wake without a lock (e.g. lid open with no password) still refreshes.
        if !locked { views.forEach { $0.playOneTransition() } }
    }

    @objc private func screensChanged() {
        buildWindows()
    }
}
