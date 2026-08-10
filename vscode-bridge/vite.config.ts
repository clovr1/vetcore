import path from 'path';
import { defineConfig, Plugin } from 'vite';

function htmlRewritePlugin(): Plugin {
  return {
    name: 'html-rewrite-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            let pathname = urlObj.pathname;
            
            if (!pathname.includes('.') && pathname !== '/') {
              if (pathname.endsWith('/')) {
                pathname = pathname.slice(0, -1);
              }
              const pages = ['patients', 'patient', 'add_patient', 'reports', 'prescriptions', 'login', 'doctor_dashboard', 'profile'];
              const pageName = pathname.substring(1);
              if (pages.includes(pageName)) {
                req.url = `/${pageName}.html${urlObj.search}`;
              }
            }
          } catch (e) {
            // ignore malformed URLs
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            let pathname = urlObj.pathname;
            
            if (!pathname.includes('.') && pathname !== '/') {
              if (pathname.endsWith('/')) {
                pathname = pathname.slice(0, -1);
              }
              const pages = ['patients', 'patient', 'add_patient', 'reports', 'prescriptions', 'login', 'doctor_dashboard', 'profile'];
              const pageName = pathname.substring(1);
              if (pages.includes(pageName)) {
                req.url = `/${pageName}.html${urlObj.search}`;
              }
            }
          } catch (e) {
            // ignore malformed URLs
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [htmlRewritePlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        patients: path.resolve(__dirname, 'patients.html'),
        patient: path.resolve(__dirname, 'patient.html'),
        add_patient: path.resolve(__dirname, 'add_patient.html'),
        reports: path.resolve(__dirname, 'reports.html'),
        prescriptions: path.resolve(__dirname, 'prescriptions.html'),
        login: path.resolve(__dirname, 'login.html'),
        doctor_dashboard: path.resolve(__dirname, 'doctor_dashboard.html'),
        profile: path.resolve(__dirname, 'profile.html'),
      },
    },
  },
});
