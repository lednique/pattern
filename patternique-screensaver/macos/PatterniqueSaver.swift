import ScreenSaver
import AppKit
import QuartzCore

/// Patternique screensaver — a fully native Core Animation port of the site's
/// animated pattern background. No WebKit: the sandboxed legacyScreenSaver
/// host frequently refuses to spawn or paint WebContent processes, which
/// shows up as a silent black screen. CALayers always render.
///
/// Engine parity with the web version:
/// - modes: grid, checker (skip), checker-2 (two figures), rotation steps
/// - column offsets, per-figure sizes and static rotations
/// - intersection elements (only when both offsets are 0)
/// - figures: 10 vector shapes + logo, emojis (~18% roll), letters of all
///   supported languages (~18% roll)
/// - background colors at least 30% apart between slides
/// - diagonal morph wave: shrink then grow with a back-out bounce,
///   scale .14 <-> 1 with opacity, 4 s hold between patterns
@objc(PatterniqueSaverView)
public class PatterniqueSaverView: ScreenSaverView {

    // MARK: - Timing (matches the web engine)

    private let waveDuration: Double = 1.3
    private let gapDuration: Double = 0.43
    private let holdDuration: Double = 4.0
    private let growTime: Double = 0.55
    private let shrinkTime: Double = 0.4

    // MARK: - Content tables

    private static let emojis = ["✨", "🌟", "💫", "🌸", "🌼", "🍀", "🍋", "🍓", "💛", "😊", "🐣", "🎈"]
    private static let letters: [String] = {
        let alphabets = [
            "ABCDEFGHKMNPRSTUWXYZ&@#?!",
            "АБВГДЖЗИКЛМНПРСТУФЦЧШЭЮЯ",
            "ÀÈÉÌÒÙ",
            "ÃÁÂÇÉÊÕÚ",
            "ÀÂÇÉÈÊËÎÔŒÙ",
            "花样图案形色美丽云星月光",
            "あいうかきくさしすなにぬパターン柄和"
        ]
        return alphabets.flatMap { $0.map(String.init) }
    }()
    private static let shapeNames = ["circle", "squircle", "star", "heart", "flower", "moon", "triangle", "ring", "plus", "bolt", "logo"]
    private static let interNames = ["circle", "star", "cross", "line"]

    // MARK: - Pattern model

    private enum Figure {
        case shape(String)
        case emoji(String)
        case letter(String)
    }

    private struct Pattern {
        var background: NSColor
        var color1: NSColor
        var color2: NSColor
        var interColor: NSColor
        var fig1: Figure
        var fig2: Figure
        var mode: String
        var shiftX: CGFloat
        var shiftY: CGFloat
        var size1: CGFloat
        var size2: CGFloat
        var rot1: CGFloat
        var rot2: CGFloat
        var rotStep: CGFloat
        var cell: CGFloat
        var decor: Figure?
    }

    // MARK: - State

    private var rootLayer = CALayer()
    private var currentCells: [CALayer] = []
    private var previousRGB: (CGFloat, CGFloat, CGFloat)?
    private var cycleTimer: Timer?

    /// Wallpaper mode ("Macintosh"-style): when false, the pattern does not
    /// cycle on its own — it settles after each wave and stays still until
    /// playOneTransition() is called (e.g. on screen unlock).
    @objc public var autoCycles: Bool = true

    /// Plays exactly one morph wave into a fresh random pattern.
    @objc public func playOneTransition() {
        cycle()
    }

    /// Renders the current (settled) pattern into a bitmap. The wallpaper app
    /// writes this to disk and sets it as the real system wallpaper so the
    /// same pattern shows natively on the lock screen and login window.
    @objc public func snapshotImage() -> NSImage? {
        let size = bounds.size
        guard size.width > 0, size.height > 0 else { return nil }
        let scale = window?.backingScaleFactor ?? (NSScreen.main?.backingScaleFactor ?? 2)
        let pixelWidth = Int(size.width * scale)
        let pixelHeight = Int(size.height * scale)
        guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil,
                                         pixelsWide: pixelWidth,
                                         pixelsHigh: pixelHeight,
                                         bitsPerSample: 8,
                                         samplesPerPixel: 4,
                                         hasAlpha: true,
                                         isPlanar: false,
                                         colorSpaceName: .deviceRGB,
                                         bytesPerRow: 0,
                                         bitsPerPixel: 0),
              let context = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
        let cg = context.cgContext
        cg.scaleBy(x: scale, y: scale)
        if let background = rootLayer.backgroundColor {
            cg.setFillColor(background)
            cg.fill(CGRect(origin: .zero, size: size))
        }
        rootLayer.render(in: cg)
        let image = NSImage(size: size)
        image.addRepresentation(rep)
        return image
    }

    // MARK: - Init

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        wantsLayer = true
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        animationTimeInterval = 1.0
        wantsLayer = true
    }

    // MARK: - Lifecycle

    public override func startAnimation() {
        super.startAnimation()
        layer?.backgroundColor = NSColor(red: 5 / 255.0, green: 7 / 255.0, blue: 8 / 255.0, alpha: 1).cgColor
        rootLayer.removeFromSuperlayer()
        rootLayer = CALayer()
        rootLayer.frame = bounds
        layer?.addSublayer(rootLayer)
        currentCells = []
        previousRGB = nil
        showPattern(makePattern(), initial: true)
        scheduleCycle()
    }

    public override func stopAnimation() {
        cycleTimer?.invalidate()
        cycleTimer = nil
        super.stopAnimation()
    }

    public override func animateOneFrame() {}

    public override var hasConfigureSheet: Bool { false }
    public override var configureSheet: NSWindow? { nil }

    private func scheduleCycle() {
        cycleTimer?.invalidate()
        guard autoCycles else { return }
        let interval = holdDuration + waveDuration + gapDuration
        cycleTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.cycle()
        }
        if let timer = cycleTimer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    private func cycle() {
        let pattern = makePattern()
        showPattern(pattern, initial: false)
    }

    // MARK: - Randomization (same math as the web engine)

    private func rand(_ a: CGFloat, _ b: CGFloat) -> CGFloat { a + CGFloat.random(in: 0...1) * (b - a) }

    private func hslToRgb(_ h: CGFloat, _ s: CGFloat, _ l: CGFloat) -> (CGFloat, CGFloat, CGFloat) {
        let sat = s / 100, lig = l / 100
        func f(_ n: CGFloat) -> CGFloat {
            let k = (n + h / 30).truncatingRemainder(dividingBy: 12)
            let a = sat * min(lig, 1 - lig)
            return lig - a * max(-1, min(k - 3, min(9 - k, 1)))
        }
        return (f(0), f(8), f(4))
    }

    private func colorDistance(_ a: (CGFloat, CGFloat, CGFloat), _ b: (CGFloat, CGFloat, CGFloat)?) -> CGFloat {
        guard let b = b else { return 1 }
        let d = sqrt(pow(a.0 - b.0, 2) + pow(a.1 - b.1, 2) + pow(a.2 - b.2, 2)) / sqrt(3)
        return d
    }

    private func hslColor(_ h: CGFloat, _ s: CGFloat, _ l: CGFloat) -> NSColor {
        let (r, g, b) = hslToRgb(h, s, l)
        return NSColor(red: r, green: g, blue: b, alpha: 1)
    }

    private func rollFigure() -> Figure {
        let r = CGFloat.random(in: 0...1)
        if r < 0.18 { return .emoji(Self.emojis.randomElement()!) }
        if r < 0.36 { return .letter(Self.letters.randomElement()!) }
        return .shape(Self.shapeNames.randomElement()!)
    }

    private func makePattern() -> Pattern {
        var bgH: CGFloat = 0, bgS: CGFloat = 0, bgL: CGFloat = 0
        var rgb: (CGFloat, CGFloat, CGFloat) = (0, 0, 0)
        var tries = 0
        repeat {
            bgH = rand(0, 360); bgS = rand(34, 64); bgL = rand(20, 42)
            rgb = hslToRgb(bgH, bgS, bgL)
            tries += 1
        } while colorDistance(rgb, previousRGB) < 0.3 && tries < 40
        previousRGB = rgb

        let shapeH = (bgH + rand(110, 250)).truncatingRemainder(dividingBy: 360)
        let modes = ["grid", "grid", "checker", "checker2", "rotate"]
        let shiftXs: [CGFloat] = [0, 0, 0, 0.5, 0.5, 0.25, -0.5]
        let shiftYs: [CGFloat] = [0, 0, 0, 0.5, 0.25]
        let shiftX = shiftXs.randomElement()!
        let shiftY = shiftYs.randomElement()!

        var decor: Figure?
        if shiftX == 0 && shiftY == 0 && CGFloat.random(in: 0...1) < 0.55 {
            let dr = CGFloat.random(in: 0...1)
            if dr < 0.18 { decor = .emoji(Self.emojis.randomElement()!) }
            else if dr < 0.36 { decor = .letter(Self.letters.randomElement()!) }
            else { decor = .shape(Self.interNames.randomElement()!) }
        }

        let cellBase = rand(130, 200)
        return Pattern(
            background: hslColor(bgH, bgS, bgL),
            color1: hslColor(shapeH, rand(45, 75), rand(56, 74)),
            color2: hslColor((shapeH + rand(40, 90)).truncatingRemainder(dividingBy: 360), rand(45, 75), rand(50, 70)),
            interColor: bgL > 32 ? NSColor(white: 0.08, alpha: 0.55) : NSColor(white: 1, alpha: 0.78),
            fig1: rollFigure(),
            fig2: rollFigure(),
            mode: modes.randomElement()!,
            shiftX: shiftX,
            shiftY: shiftY,
            size1: rand(0.46, 0.88),
            size2: rand(0.36, 0.66),
            rot1: [0, 0, 0, 15, 45, -15, 90].randomElement()!,
            rot2: [0, 0, 180, 45, -45].randomElement()!,
            rotStep: [15, 30, 45, -15, -30].randomElement()!,
            cell: isPreview ? max(36, cellBase * 0.35) : cellBase,
            decor: decor
        )
    }

    // MARK: - Building and animating a pattern

    private func showPattern(_ pattern: Pattern, initial: Bool) {
        let scale = window?.backingScaleFactor ?? (NSScreen.main?.backingScaleFactor ?? 2)
        let width = bounds.width, height = bounds.height
        let cell = pattern.cell
        let cols = Int(ceil(width / cell)) + 2
        let rows = Int(ceil(height / cell)) + 2
        let step = waveDuration / Double(cols + rows)
        let now = CACurrentMediaTime()

        // Background color crossfade (2 s, like the web transition).
        let bgAnim = CABasicAnimation(keyPath: "backgroundColor")
        bgAnim.fromValue = rootLayer.backgroundColor
        bgAnim.duration = 2.0
        rootLayer.backgroundColor = pattern.background.cgColor
        rootLayer.add(bgAnim, forKey: "bg")

        // Old cells shrink at their wave time, then leave.
        let oldCells = currentCells
        for cellLayer in oldCells {
            let delay = cellLayer.value(forKey: "waveDelay") as? Double ?? 0
            animate(cellLayer, grow: false, beginTime: now + delay)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + waveDuration + shrinkTime + 0.3) {
            oldCells.forEach { $0.removeFromSuperlayer() }
        }

        // New cells grow right after the old figure shrank in each cell.
        var newCells: [CALayer] = []
        let growOffset = initial ? 0 : gapDuration
        for r in 0..<rows {
            for c in 0..<cols {
                if pattern.mode == "checker" && (r + c) % 2 == 1 { continue }
                let alt = pattern.mode == "checker2" && (r + c) % 2 == 1
                let x = CGFloat(c - 1) * cell + (r % 2 == 1 ? cell * pattern.shiftX : 0)
                let yTop = CGFloat(r - 1) * cell + (c % 2 == 1 ? cell * pattern.shiftY : 0)
                let y = height - yTop - cell // flip so the wave starts at the top-left
                let angle = pattern.mode == "rotate"
                    ? CGFloat(r + c) * pattern.rotStep
                    : (alt ? pattern.rot2 : pattern.rot1)
                let size = max(24, cell * (alt ? pattern.size2 : pattern.size1))
                let figure = alt ? pattern.fig2 : pattern.fig1
                let color = alt ? pattern.color2 : pattern.color1

                let container = CALayer()
                container.frame = CGRect(x: x, y: y, width: cell, height: cell)
                if let fig = figureLayer(figure, color: color, size: size, scale: scale) {
                    fig.position = CGPoint(x: cell / 2, y: cell / 2)
                    if angle != 0 {
                        fig.setAffineTransform(CGAffineTransform(rotationAngle: -angle * .pi / 180))
                    }
                    container.addSublayer(fig)
                }
                let delay = Double(r + c) * step
                container.setValue(delay, forKey: "waveDelay")
                prepareHidden(container)
                rootLayer.addSublayer(container)
                animate(container, grow: true, beginTime: now + growOffset + delay)
                newCells.append(container)
            }
        }

        // Intersection elements share the same wave.
        if let decor = pattern.decor {
            let iSize = max(16, cell * 0.2)
            for ir in 0...rows {
                for ic in 0...cols {
                    let x = CGFloat(ic - 1) * cell - iSize / 2
                    let y = height - (CGFloat(ir - 1) * cell) - iSize / 2
                    let container = CALayer()
                    container.frame = CGRect(x: x, y: y, width: iSize, height: iSize)
                    if let fig = figureLayer(decor, color: pattern.interColor, size: iSize, scale: scale) {
                        fig.position = CGPoint(x: iSize / 2, y: iSize / 2)
                        container.addSublayer(fig)
                    }
                    let delay = Double(ir + ic) * step
                    container.setValue(delay, forKey: "waveDelay")
                    prepareHidden(container)
                    rootLayer.addSublayer(container)
                    animate(container, grow: true, beginTime: now + growOffset + delay)
                    newCells.append(container)
                }
            }
        }
        currentCells = newCells
    }

    private func prepareHidden(_ layer: CALayer) {
        layer.transform = CATransform3DMakeScale(0.14, 0.14, 1)
        layer.opacity = 0
    }

    /// Shrink ease-in and grow back-out curves copied from the web CSS.
    private func animate(_ layer: CALayer, grow: Bool, beginTime: CFTimeInterval) {
        let timing = grow
            ? CAMediaTimingFunction(controlPoints: 0.26, 1.36, 0.5, 1.0)
            : CAMediaTimingFunction(controlPoints: 0.55, 0.06, 0.68, 0.19)
        let duration = grow ? growTime : shrinkTime
        let fromScale: CGFloat = grow ? 0.14 : 1
        let toScale: CGFloat = grow ? 1 : 0.14
        let fromOpacity: Float = grow ? 0 : 1
        let toOpacity: Float = grow ? 1 : 0

        // Set the final model values, then animate from the previous state.
        layer.transform = CATransform3DMakeScale(toScale, toScale, 1)
        layer.opacity = toOpacity

        let scaleAnim = CABasicAnimation(keyPath: "transform.scale")
        scaleAnim.fromValue = fromScale
        scaleAnim.toValue = toScale
        let fadeAnim = CABasicAnimation(keyPath: "opacity")
        fadeAnim.fromValue = fromOpacity
        fadeAnim.toValue = toOpacity
        let group = CAAnimationGroup()
        group.animations = [scaleAnim, fadeAnim]
        group.duration = duration
        group.timingFunction = timing
        group.beginTime = beginTime
        group.fillMode = .backwards
        layer.add(group, forKey: grow ? "grow" : "shrink")
    }

    // MARK: - Figure layers

    private func figureLayer(_ figure: Figure, color: NSColor, size: CGFloat, scale: CGFloat) -> CALayer? {
        switch figure {
        case .emoji(let s):
            return textLayer(s, fontSize: size * 0.92, color: nil, scale: scale)
        case .letter(let s):
            return textLayer(s, fontSize: size * 0.92, color: color.withAlphaComponent(0.85), scale: scale)
        case .shape(let name):
            let isLogo = name == "logo"
            let h = isLogo ? size * 154 / 270 : size
            let shape = CAShapeLayer()
            shape.bounds = CGRect(x: 0, y: 0, width: size, height: h)
            shape.contentsScale = scale
            guard let path = Self.path(for: name) else { return nil }
            var transform = CGAffineTransform(scaleX: size / (isLogo ? 270 : 100), y: h / (isLogo ? 154 : 100))
            guard let scaled = path.copy(using: &transform) else { return nil }
            shape.path = scaled
            shape.fillColor = color.withAlphaComponent(0.85).cgColor
            shape.fillRule = (name == "ring" || name == "moon" || name == "logo") ? .evenOdd : .nonZero
            return shape
        }
    }

    /// Emoji and letters are rasterized through NSImage so color emoji render
    /// correctly (CATextLayer draws them monochrome).
    private func textLayer(_ string: String, fontSize: CGFloat, color: NSColor?, scale: CGFloat) -> CALayer? {
        let font = color == nil
            ? NSFont.systemFont(ofSize: fontSize)
            : NSFont.systemFont(ofSize: fontSize, weight: .heavy)
        var attributes: [NSAttributedString.Key: Any] = [.font: font]
        if let color = color { attributes[.foregroundColor] = color }
        let attributed = NSAttributedString(string: string, attributes: attributes)
        let textSize = attributed.size()
        guard textSize.width > 0, textSize.height > 0 else { return nil }
        let image = NSImage(size: textSize, flipped: false) { _ in
            attributed.draw(at: .zero)
            return true
        }
        let layer = CALayer()
        layer.bounds = CGRect(origin: .zero, size: textSize)
        layer.contents = image
        layer.contentsScale = scale
        return layer
    }

    // MARK: - Vector paths (100x100 space, y-down like SVG; flipped at the end)

    private static var pathCache: [String: CGPath] = [:]

    private static func path(for name: String) -> CGPath? {
        if let cached = pathCache[name] { return cached }
        let raw: CGPath?
        switch name {
        case "circle":
            raw = CGPath(ellipseIn: CGRect(x: 4, y: 4, width: 92, height: 92), transform: nil)
        case "squircle":
            raw = CGPath(roundedRect: CGRect(x: 4, y: 4, width: 92, height: 92), cornerWidth: 30, cornerHeight: 30, transform: nil)
        case "star":
            raw = polygon([(50, 0), (62, 38), (100, 50), (62, 62), (50, 100), (38, 62), (0, 50), (38, 38)])
        case "heart":
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 50, y: 92))
            p.addCurve(to: CGPoint(x: 4, y: 30), control1: CGPoint(x: 20, y: 68), control2: CGPoint(x: 4, y: 48))
            p.addCurve(to: CGPoint(x: 30, y: 4), control1: CGPoint(x: 4, y: 15), control2: CGPoint(x: 16, y: 4))
            p.addCurve(to: CGPoint(x: 50, y: 16), control1: CGPoint(x: 39, y: 4), control2: CGPoint(x: 46, y: 8))
            p.addCurve(to: CGPoint(x: 70, y: 4), control1: CGPoint(x: 54, y: 8), control2: CGPoint(x: 61, y: 4))
            p.addCurve(to: CGPoint(x: 96, y: 30), control1: CGPoint(x: 84, y: 4), control2: CGPoint(x: 96, y: 15))
            p.addCurve(to: CGPoint(x: 50, y: 92), control1: CGPoint(x: 96, y: 48), control2: CGPoint(x: 80, y: 68))
            p.closeSubpath()
            raw = p
        case "flower":
            let p = CGMutablePath()
            for center in [(50, 21), (79, 50), (50, 79), (21, 50)] {
                p.addEllipse(in: CGRect(x: CGFloat(center.0) - 19, y: CGFloat(center.1) - 19, width: 38, height: 38))
            }
            p.addEllipse(in: CGRect(x: 33, y: 33, width: 34, height: 34))
            raw = p
        case "moon":
            // Crescent: outer circle minus an internally tangent inner circle.
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 2, y: 2, width: 96, height: 96))
            p.addEllipse(in: CGRect(x: 26, y: 14, width: 72, height: 72))
            raw = p
        case "triangle":
            raw = polygon([(50, 6), (92, 88), (8, 88)])
        case "ring":
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 2, y: 2, width: 96, height: 96))
            p.addEllipse(in: CGRect(x: 29, y: 29, width: 42, height: 42))
            raw = p
        case "plus":
            raw = polygon([(34, 2), (66, 2), (66, 34), (98, 34), (98, 66), (66, 66), (66, 98), (34, 98), (34, 66), (2, 66), (2, 34), (34, 34)])
        case "bolt":
            raw = polygon([(60, 0), (14, 58), (38, 58), (40, 100), (88, 40), (64, 40)])
        case "cross":
            raw = polygon([(22, 32), (32, 22), (50, 40), (68, 22), (78, 32), (60, 50), (78, 68), (68, 78), (50, 60), (32, 78), (22, 68), (40, 50)])
        case "line":
            let p = CGMutablePath()
            p.addRoundedRect(in: CGRect(x: 8, y: 44, width: 84, height: 12), cornerWidth: 6, cornerHeight: 6,
                             transform: CGAffineTransform(translationX: 50, y: 50).rotated(by: -.pi / 4).translatedBy(x: -50, y: -50))
            raw = p
        case "logo":
            raw = parseSVGPath(logoPath)
        default:
            raw = nil
        }
        guard let path = raw else { return nil }
        // Flip vertically: our coordinates are SVG-style y-down, CALayer is y-up.
        let boxHeight: CGFloat = name == "logo" ? 154 : 100
        var flip = CGAffineTransform(scaleX: 1, y: -1).translatedBy(x: 0, y: -boxHeight)
        let flipped = path.copy(using: &flip) ?? path
        pathCache[name] = flipped
        return flipped
    }

    private static func polygon(_ points: [(CGFloat, CGFloat)]) -> CGPath {
        let p = CGMutablePath()
        guard let first = points.first else { return p }
        p.move(to: CGPoint(x: first.0, y: first.1))
        for point in points.dropFirst() { p.addLine(to: CGPoint(x: point.0, y: point.1)) }
        p.closeSubpath()
        return p
    }

    // MARK: - Logo path (absolute M/L/C/Z SVG commands only)

    private static let logoPath = "M147.743 0L148.123 17.4785L148.115 17.4795C141.81 17.7267 135.522 18.1788 129.245 18.8291C99.5876 21.9016 68.3338 28.9385 43.0706 45.6631C31.2004 53.5214 6.65184 76.6465 21.9154 91.5332C31.4763 100.857 47.4502 100.691 60.0277 100.318C59.9115 76.1196 74.7146 58.4637 92.6312 50.4258C112.022 41.7268 137.492 43.489 151.661 62.9668C158.37 72.1881 159.389 84.5443 158.386 95.6006C158.087 98.9036 157.458 102.156 156.906 105.423C151.243 106.474 145.58 107.507 139.901 108.465C120.43 111.75 100.855 114.618 81.1898 116.443C85.7207 124.68 94.3642 130.346 106.725 133.588C123.89 138.089 146.621 137.267 169.489 132.052C192.294 126.85 214.218 117.508 229.746 105.946C245.6 94.1434 252.786 81.6832 251.446 70.2246C249.136 50.4766 227.434 38.5972 211.166 31.5293C201.614 27.3793 191.678 24.1185 181.595 21.5273L180.891 104.585C183.825 103.795 187.355 102.727 191.389 101.29L197.2 117.771C189.954 120.351 184.057 121.906 179.904 122.824C174.43 124.034 168.882 124.515 163.319 125.131L164.378 0.163086C182.811 3.50544 200.813 7.98237 218.072 15.4805C240.521 25.234 265.621 41.6501 268.725 68.1836C271.168 89.0719 257.694 106.899 240.104 119.995C222.189 133.333 197.884 143.503 173.338 149.102C148.854 154.686 123.108 155.952 102.331 150.504C84.24 145.759 68.7806 135.457 62.7669 117.714C44.6071 118.426 23.5483 117.489 9.79816 104.079C-14.5568 80.3255 11.5127 45.6187 33.4984 31.0635C61.1416 12.763 94.9654 4.80307 127.461 1.43652C134.2 0.738377 140.968 0.194353 147.743 0ZM137.618 73.2842C129.779 62.5091 114.203 59.8964 99.7239 66.3916C87.4769 71.886 77.7952 83.3018 77.4417 99.2266C98.8287 97.3422 120.117 94.1614 141.265 90.4951C141.423 84.7624 141.095 78.0651 137.618 73.2842Z"

    private static func parseSVGPath(_ d: String) -> CGPath? {
        let path = CGMutablePath()
        let scanner = Scanner(string: d)
        scanner.charactersToBeSkipped = CharacterSet(charactersIn: " ,\n")

        func scanNumber() -> CGFloat? {
            scanner.scanDouble().map { CGFloat($0) }
        }
        func scanPoint() -> CGPoint? {
            guard let x = scanNumber(), let y = scanNumber() else { return nil }
            return CGPoint(x: x, y: y)
        }

        var command: Character?
        while !scanner.isAtEnd {
            // scanString only consumes on a match, so implicit repeated
            // coordinate pairs are never corrupted.
            if scanner.scanString("Z") != nil { path.closeSubpath(); command = nil; continue }
            if scanner.scanString("M") != nil { command = "M" }
            else if scanner.scanString("L") != nil { command = "L" }
            else if scanner.scanString("C") != nil { command = "C" }

            switch command {
            case "M":
                guard let p = scanPoint() else { return path }
                path.move(to: p)
                command = "L" // subsequent pairs are implicit line-tos
            case "L":
                guard let p = scanPoint() else { return path }
                path.addLine(to: p)
            case "C":
                guard let c1 = scanPoint(), let c2 = scanPoint(), let p = scanPoint() else { return path }
                path.addCurve(to: p, control1: c1, control2: c2)
            default:
                guard scanner.scanCharacter() != nil else { return path }
            }
        }
        return path
    }
}
