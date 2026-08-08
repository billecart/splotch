cd "`dirname "$0"`"

cd app
npm install
npm run build-package -- -zip mac win32 win64 linux
