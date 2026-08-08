cd "`dirname "$0"`"

# Uses: https://github.com/electron/packager
# (installed as a devDependency of app/, invoked via npx below)

# Clean
rm -rf splotch-linux-x64/
rm -rf ReleaseUpload

# Ensure it's correctly/fully installed first
( cd app && npm install )

# Linux
npx --yes @electron/packager app splotch --platform=linux --arch=x64 --icon=resources/Icon.icns --extend-info=resources/info.plist --prune --asar.unpackDir="main-process/ink" --ignore="inklecate_mac"

# Create a zip file ready for upload on Windows/Linux
mkdir -p ReleaseUpload
zip -r ReleaseUpload/splotch_linux.zip splotch-linux-x64

#Prepare AppImage build structure
mkdir -p AppImage/opt/splotch
mkdir -p AppImage/usr/share/pixmaps

cp resources/AppRun AppImage/
cp resources/com.billecart.splotch.desktop AppImage/
cp resources/Icon1024.png AppImage/splotch.png
cp resources/Icon1024.png AppImage/usr/share/pixmaps/splotch.png
cp -r splotch-linux-x64/* AppImage/opt/splotch/

#Build AppImage File ready for upload
ARCH=x86_64 ./build/appimagetool-x86_64.AppImage -n AppImage ReleaseUpload/splotch.AppImage
