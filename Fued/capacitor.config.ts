import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: "io.ionic.demo.pg.cap.ng",
  appName: "Photo Gallery Cap Ng",
  npmClient: "npm",
  webDir: "www",
  // La API de desarrollo es http:// (XAMPP en la red local) y la app carga desde https://localhost.
  android: {
    allowMixedContent: true,
  },
};

export default config;
