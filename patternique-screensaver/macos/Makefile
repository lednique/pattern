# Builds Patternique.saver — a native macOS screensaver bundle.
# Requires macOS with Xcode Command Line Tools (xcode-select --install).
#
#   make           build Patternique.saver (universal: arm64 + x86_64)
#   make install   build, install into ~/Library/Screen Savers, reset cache
#   make clean

NAME    = Patternique
BUNDLE  = $(NAME).saver
SRC     = PatterniqueSaver.swift
HTML    = ../screensaver.html
MIN     = 11.0

all: $(BUNDLE)

$(BUNDLE): $(SRC) Info.plist $(HTML)
	rm -rf $(BUNDLE)
	mkdir -p $(BUNDLE)/Contents/MacOS $(BUNDLE)/Contents/Resources
	swiftc -parse-as-library -target arm64-apple-macos$(MIN) \
		-framework ScreenSaver -framework WebKit \
		-emit-library $(SRC) -o $(NAME)-arm64
	swiftc -parse-as-library -target x86_64-apple-macos$(MIN) \
		-framework ScreenSaver -framework WebKit \
		-emit-library $(SRC) -o $(NAME)-x86_64
	lipo -create $(NAME)-arm64 $(NAME)-x86_64 -output $(BUNDLE)/Contents/MacOS/$(NAME)
	rm -f $(NAME)-arm64 $(NAME)-x86_64
	cp Info.plist $(BUNDLE)/Contents/Info.plist
	cp $(HTML) $(BUNDLE)/Contents/Resources/screensaver.html
	codesign --force --deep --sign - $(BUNDLE)

install: all
	rm -rf "$$HOME/Library/Screen Savers/$(BUNDLE)"
	cp -R $(BUNDLE) "$$HOME/Library/Screen Savers/"
	@# macOS keeps the old saver loaded inside legacyScreenSaver — kill the
	@# cached hosts so the new build is actually used (they respawn safely).
	-killall legacyScreenSaver 2>/dev/null || true
	-killall "System Settings" 2>/dev/null || true
	@echo "Installed. Choose Patternique in System Settings → Screen Saver."

clean:
	rm -rf $(BUNDLE) $(NAME)-arm64 $(NAME)-x86_64

.PHONY: all install clean
