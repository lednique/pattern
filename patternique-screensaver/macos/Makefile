# Builds Patternique.saver — a native macOS screensaver bundle.
# Requires macOS with Xcode Command Line Tools (xcode-select --install).
#
#   make            build Patternique.saver for THIS Mac's architecture
#   make universal  build a universal (arm64 + x86_64) bundle — needs a
#                   toolchain with x86_64 Swift compatibility libs (full Xcode)
#   make install    build for this Mac, install, reset the saver cache
#   make clean
#
# Default is single-arch on purpose: standalone Command Line Tools often ship
# arm64-only libswiftCompatibility*.a, which breaks the x86_64 link with
# "__swift_FORCE_LOAD_$_swiftCompatibility56 ... not found". The saver runs
# in-process on the local machine, so the native slice is all that's needed.

NAME    = Patternique
BUNDLE  = $(NAME).saver
SRC     = PatterniqueSaver.swift
MIN     = 11.0
ARCH    := $(shell uname -m)

FRAMEWORKS = -framework ScreenSaver -framework AppKit -framework QuartzCore

all: $(BUNDLE)

$(BUNDLE): $(SRC) Info.plist
	rm -rf $(BUNDLE)
	mkdir -p $(BUNDLE)/Contents/MacOS $(BUNDLE)/Contents/Resources
	swiftc -parse-as-library -target $(ARCH)-apple-macos$(MIN) \
		$(FRAMEWORKS) -emit-library $(SRC) -o $(BUNDLE)/Contents/MacOS/$(NAME)
	cp Info.plist $(BUNDLE)/Contents/Info.plist
	codesign --force --deep --sign - $(BUNDLE)

universal: $(SRC) Info.plist
	rm -rf $(BUNDLE)
	mkdir -p $(BUNDLE)/Contents/MacOS $(BUNDLE)/Contents/Resources
	swiftc -parse-as-library -target arm64-apple-macos$(MIN) \
		$(FRAMEWORKS) -emit-library $(SRC) -o $(NAME)-arm64
	swiftc -parse-as-library -target x86_64-apple-macos$(MIN) \
		$(FRAMEWORKS) -emit-library $(SRC) -o $(NAME)-x86_64
	lipo -create $(NAME)-arm64 $(NAME)-x86_64 -output $(BUNDLE)/Contents/MacOS/$(NAME)
	rm -f $(NAME)-arm64 $(NAME)-x86_64
	cp Info.plist $(BUNDLE)/Contents/Info.plist
	codesign --force --deep --sign - $(BUNDLE)

install: all
	rm -rf "$$HOME/Library/Screen Savers/$(BUNDLE)"
	cp -R $(BUNDLE) "$$HOME/Library/Screen Savers/"
	@# macOS keeps the old saver loaded inside legacyScreenSaver — kill the
	@# cached hosts so the new build is actually used (they respawn safely).
	-killall legacyScreenSaver 2>/dev/null || true
	-killall "System Settings" 2>/dev/null || true
	@echo "Installed ($(ARCH)). Choose Patternique in System Settings → Screen Saver."

clean:
	rm -rf $(BUNDLE) $(NAME)-arm64 $(NAME)-x86_64 "$(WP_APP)"

# ---------------------------------------------------------------------------
# Live wallpaper ("Macintosh"-style): the same pattern engine drawn behind the
# desktop icons. Still while you work; plays one morph wave after each unlock.
#
#   make wallpaper           build "Patternique Wallpaper.app"
#   make wallpaper-install   build, install to /Applications, autostart at
#                            login (LaunchAgent), and start it now
#   make wallpaper-uninstall stop and remove the app and the LaunchAgent
# ---------------------------------------------------------------------------

WP_NAME  = PatterniqueWallpaper
WP_APP   = Patternique Wallpaper.app
WP_SRC   = PatterniqueSaver.swift PatterniqueWallpaper.swift
WP_AGENT = ru.lednique.patternique.wallpaper

wallpaper: $(WP_SRC) Wallpaper-Info.plist
	rm -rf "$(WP_APP)"
	mkdir -p "$(WP_APP)/Contents/MacOS" "$(WP_APP)/Contents/Resources"
	swiftc -parse-as-library -target $(ARCH)-apple-macos$(MIN) \
		$(FRAMEWORKS) $(WP_SRC) -o "$(WP_APP)/Contents/MacOS/$(WP_NAME)"
	cp Wallpaper-Info.plist "$(WP_APP)/Contents/Info.plist"
	codesign --force --deep --sign - "$(WP_APP)"

wallpaper-install: wallpaper
	-killall $(WP_NAME) 2>/dev/null || true
	rm -rf "/Applications/$(WP_APP)"
	cp -R "$(WP_APP)" /Applications/
	mkdir -p "$$HOME/Library/LaunchAgents"
	printf '%s\n' \
	  '<?xml version="1.0" encoding="UTF-8"?>' \
	  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
	  '<plist version="1.0"><dict>' \
	  '  <key>Label</key><string>$(WP_AGENT)</string>' \
	  '  <key>ProgramArguments</key><array>' \
	  '    <string>/Applications/$(WP_APP)/Contents/MacOS/$(WP_NAME)</string>' \
	  '  </array>' \
	  '  <key>RunAtLoad</key><true/>' \
	  '  <key>KeepAlive</key><true/>' \
	  '</dict></plist>' \
	  > "$$HOME/Library/LaunchAgents/$(WP_AGENT).plist"
	-launchctl unload "$$HOME/Library/LaunchAgents/$(WP_AGENT).plist" 2>/dev/null || true
	launchctl load "$$HOME/Library/LaunchAgents/$(WP_AGENT).plist"
	@echo "Wallpaper installed and running; it will start automatically at login."

wallpaper-uninstall:
	-launchctl unload "$$HOME/Library/LaunchAgents/$(WP_AGENT).plist" 2>/dev/null || true
	rm -f "$$HOME/Library/LaunchAgents/$(WP_AGENT).plist"
	-killall $(WP_NAME) 2>/dev/null || true
	rm -rf "/Applications/$(WP_APP)"
	@echo "Wallpaper removed."

.PHONY: all universal install clean wallpaper wallpaper-install wallpaper-uninstall
