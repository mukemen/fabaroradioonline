// Konfigurasi Capacitor untuk build APK (tidak dipakai saat deploy web)
const config = {
  appId: 'com.fabaro.radio',
  appName: 'FABARO Radio Online',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

module.exports = config;
