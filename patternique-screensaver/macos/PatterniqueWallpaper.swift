import AppKit
import QuartzCore

/// Patternique Wallpaper — behaves like macOS' own dynamic
/// screensaver-wallpapers ("Macintosh" etc.), not like an app drawn on top:
///
/// - The settled pattern is written to disk and set as the REAL system
///   wallpaper via NSWorkspace.setDesktopImageURL. Because it is the actual
///   desktop picture, macOS shows the very same pattern natively on the
///   lock screen and the login window — no windows involved.
/// - Between transitions the app draws NOTHING. The desktop shows the
///   ordinary static wallpaper file; the agent just sleeps.
/// - On unlock (and wake) a borderless stage window appears at the desktop
///   picture level, seeded with the current pattern so the handoff is
///   invisible, plays exactly one morph wave into a fresh pattern, then the
///   new frame is committed as the system wallpaper and the stage vanishes.
///
/// Build & install: `make wallpaper-install` (see Makefile). The app is a
/// background agent (LSUIElement) with no Dock icon or menu bar.
@main
final class PatterniqueWallpaperApp: NSObject, NSApplicationDelegate {

    private struct Stage {
        let window: NSWindow
        let view: PatterniqueSaverView
        let screen: NSScreen
    }

    private var stages: [Stage] = []
    private var locked = false
    private var transitioning = false
    private var wallpaperFlip = false // alternate A/B files so macOS reloads them

    private var supportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("Patternique", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func main() {
        let app = NSApplication.shared
        let delegate = PatterniqueWallpaperApp()
        app.delegate = delegate
        app.setActivationPolicy(.accessory) // no Dock icon, no menu bar
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildStages()
        // First launch: build the initial pattern with its wave, then commit
        // it as the real wallpaper and disappear.
        runTransition(initial: true)

        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(self, selector: #selector(screenLocked),
                        name: NSNotification.Name("com.apple.screenIsLocked"), object: nil)
        dnc.addObserver(self, selector: #selector(screenUnlocked),
                        name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(didWake),
            name: NSWorkspace.didWakeNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    // MARK: - Stage windows (visible only while a wave is playing)

    private func buildStages() {
        stages.forEach { $0.window.orderOut(nil) }
        stages = []
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
            view.autoCycles = false
            window.contentView = view
            stages.append(Stage(window: window, view: view, screen: screen))
        }
    }

    // MARK: - The one-wave transition

    private func runTransition(initial: Bool) {
        guard !transitioning, !locked, !stages.isEmpty else { return }
        transitioning = true

        for stage in stages {
            stage.window.orderBack(nil) // shows the current settled pattern
            if initial {
                stage.view.startAnimation() // builds the first pattern with a wave
            } else {
                stage.view.playOneTransition()
            }
        }

        // Wave (1.3 s) + gap (0.43 s) + grow (0.55 s) + safety margin.
        let settleDelay: TimeInterval = 1.3 + 0.43 + 0.55 + 0.5
        DispatchQueue.main.asyncAfter(deadline: .now() + settleDelay) { [weak self] in
            self?.commitWallpaperAndHide()
        }
    }

    /// Renders each stage's settled pattern to a file, makes it the real
    /// system wallpaper, then removes the stage windows entirely.
    private func commitWallpaperAndHide() {
        wallpaperFlip.toggle()
        let suffix = wallpaperFlip ? "a" : "b"
        for (index, stage) in stages.enumerated() {
            guard let image = stage.view.snapshotImage(),
                  let tiff = image.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else { continue }
            let url = supportDirectory.appendingPathComponent("wallpaper-\(index)-\(suffix).png")
            do {
                try png.write(to: url)
                try NSWorkspace.shared.setDesktopImageURL(url, for: stage.screen, options: [:])
            } catch {
                // If the wallpaper cannot be set, keep the stage visible so the
                // desktop is never left without the pattern.
                transitioning = false
                return
            }
        }
        // The real wallpaper now shows the identical frame — drop the windows.
        stages.forEach { $0.window.orderOut(nil) }
        transitioning = false
    }

    // MARK: - Events

    @objc private func screenLocked() {
        locked = true
        // Between transitions nothing runs; ensure any in-flight timers stop.
        stages.forEach { if $0.view.isAnimating { $0.view.stopAnimation() } }
    }

    @objc private func screenUnlocked() {
        guard locked else { return }
        locked = false
        // Like the Macintosh wallpaper: one morph right after unlocking.
        runTransition(initial: false)
    }

    @objc private func didWake() {
        if !locked { runTransition(initial: false) }
    }

    @objc private func screensChanged() {
        buildStages()
        runTransition(initial: true)
    }
}
