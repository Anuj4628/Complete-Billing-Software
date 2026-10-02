module.exports = {
  appId: 'com.gstbilling.app',
  productName: 'Sunmarg Billing App',
  copyright: 'Copyright © 2024',
  directories: {
    output: 'dist-electron',
    buildResources: 'assets',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    '!electron/**/*.test.js',
    'node_modules/**/*',
    '!node_modules/.cache/**/*',
  ],
  extraResources: [
    {
      from: 'assets/',
      to: 'assets/',
      filter: ['**/*'],
    },
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Sunmarg Billing App',
    include: 'assets/installer.nsh',
  },
  mac: {
    target: 'dmg',
    icon: 'assets/icon.icns',
  },
  linux: {
    target: 'AppImage',
    icon: 'assets/icon.png',
  },
  publish: {
    provider: 'github',
    releaseType: 'release',
  },
}
