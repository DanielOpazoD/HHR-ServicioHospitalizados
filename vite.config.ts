import fs from 'node:fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Generate version.json directly in the build output so the repo does not
 * accumulate tracked diffs on every build.
 */
function versionPlugin(): Plugin {
  let versionInfo: { version: string; buildDate: string } | null = null;

  return {
    name: 'version-plugin',
    buildStart() {
      versionInfo = {
        version: Date.now().toString(),
        buildDate: new Date().toISOString(),
      };
      console.log(`[versionPlugin] Prepared version.json: ${versionInfo.version}`);
    },
    generateBundle() {
      if (!versionInfo) return;
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionInfo, null, 2),
      });
    },
  };
}

function excelJsRuntimeAssetPlugin(): Plugin {
  const runtimeAssetPath = path.resolve(
    __dirname,
    'node_modules',
    'exceljs',
    'dist',
    'exceljs.min.js'
  );
  const runtimeAssetRoute = '/vendor/exceljs.min.js';

  return {
    name: 'exceljs-runtime-asset',
    configureServer(server) {
      server.middlewares.use(runtimeAssetRoute, (_req, res, next) => {
        try {
          const source = fs.readFileSync(runtimeAssetPath);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end(source);
        } catch (error) {
          next(error as Error);
        }
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'vendor/exceljs.min.js',
        source: fs.readFileSync(runtimeAssetPath, 'utf8'),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const chunkForModule = (moduleId: string): string | undefined => {
    const normalizedId = moduleId.replace(/\\/g, '/');
    const inNodeModules = normalizedId.includes('/node_modules/');
    const has = (fragment: string): boolean => normalizedId.includes(fragment);

    if (!inNodeModules) {
      if (has('/src/features/census/components/patient-row/')) {
        return 'feature-census-patient-row';
      }

      if (
        has('/src/features/census/controllers/') ||
        has('/src/features/census/domain/movements/') ||
        has('/src/features/census/validation/')
      ) {
        return 'feature-census-runtime';
      }

      if (has('/src/features/clinical-documents/')) {
        return 'feature-clinical-documents';
      }

      if (has('/src/features/transfers/')) {
        return 'feature-transfers';
      }

      if (has('/src/application/backup-export/') || has('/src/services/backup/')) {
        return 'feature-backup-storage';
      }
    }

    if (inNodeModules) {
      // Keep React together with UI libs that depend on it
      if (
        has('/node_modules/react/') ||
        has('/node_modules/react-dom/') ||
        has('/node_modules/lucide-react/')
      ) {
        return 'vendor-react';
      }

      if (
        has('/node_modules/@tanstack/react-query/') ||
        has('/node_modules/@tanstack/query-core/') ||
        has('/node_modules/@tanstack/react-virtual/')
      ) {
        return 'vendor-tanstack';
      }

      if (has('/node_modules/dexie/')) {
        return 'vendor-localdb';
      }

      if (has('/node_modules/zod/')) {
        return 'vendor-zod';
      }

      // Keep Firebase core together and isolate auxiliary SDKs (storage/functions)
      // so login bootstrap does not pay the cost of optional modules.
      if (has('/node_modules/firebase/') || has('/node_modules/@firebase/')) {
        if (
          has('/node_modules/firebase/storage') ||
          has('/node_modules/firebase/functions') ||
          has('/node_modules/@firebase/storage') ||
          has('/node_modules/@firebase/functions')
        ) {
          return 'vendor-firebase-aux';
        }
        return 'vendor-firebase-core';
      }

      // HTML to Canvas (lazy loaded for screenshots)
      if (has('/node_modules/html2canvas/')) {
        return 'vendor-canvas';
      }

      // 3D map stack: split into focused chunks to avoid one near-limit artifact.
      if (has('/node_modules/three/examples/')) {
        return 'vendor-three-stdlib';
      }
      if (has('/node_modules/three/')) {
        return 'vendor-three-core';
      }
      if (has('/node_modules/@react-three/')) {
        return 'vendor-three-react';
      }
      if (
        has('/node_modules/three-stdlib/') ||
        has('/node_modules/meshline/') ||
        has('/node_modules/troika-') ||
        has('/node_modules/camera-controls/')
      ) {
        return 'vendor-three-stdlib';
      }

      // Excel stack: break by concern to keep chunk growth controlled.
      if (has('/node_modules/exceljs/lib/xlsx/')) {
        return 'vendor-excel-xlsx';
      }
      if (has('/node_modules/exceljs/lib/stream/')) {
        return 'vendor-excel-stream';
      }
      if (has('/node_modules/exceljs/lib/csv/')) {
        return 'vendor-excel-csv';
      }
      if (
        has('/node_modules/jszip/') ||
        has('/node_modules/pako/') ||
        has('/node_modules/crc32-stream/') ||
        has('/node_modules/compress-commons/')
      ) {
        return 'vendor-excel-zip';
      }
      if (
        has('/node_modules/readable-stream/') ||
        has('/node_modules/sax/') ||
        has('/node_modules/saxes/')
      ) {
        return 'vendor-excel-stream';
      }
      if (
        has('/node_modules/archiver/') ||
        has('/node_modules/fast-csv/') ||
        has('/node_modules/dayjs/')
      ) {
        return 'vendor-excel-xml';
      }
      if (has('/node_modules/exceljs/')) {
        return 'vendor-excel-core';
      }

      if (has('/node_modules/jspdf/') || has('/node_modules/jspdf-autotable/')) {
        return 'vendor-pdf';
      }
    }

    return undefined;
  };

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      versionPlugin(),
      excelJsRuntimeAssetPlugin(),
      react(),
      tailwindcss(),
      // PWA plugin configuration
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.js',
        injectManifest: {
          swSrc: 'src/service-worker.ts',
          injectionPoint: 'self.__WB_MANIFEST',
        },
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          name: 'Hanga Roa Hospital Tracker',
          short_name: 'HHR',
          description: 'Sistema de gestión de censo hospitalario del Hospital Hanga Roa',
          theme_color: '#0284c7',
          background_color: '#f8fafc',
          display: 'standalone',
          icons: [
            {
              src: 'images/logos/logo_HHR.png', // Using existing logo as base
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'images/logos/logo_HHR.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        devOptions: {
          enabled: false, // Disabling SW in dev to prevent source code caching/interfering
          type: 'module',
        },
      }),
      // Gzip compression for production builds
      isProduction &&
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 10240, // Only compress files > 10KB
          deleteOriginFile: false,
        }),
      // Brotli compression (better ratio than gzip)
      isProduction &&
        viteCompression({
          algorithm: 'brotliCompress',
          ext: '.br',
          threshold: 10240,
          deleteOriginFile: false,
        }),
    ].filter(Boolean),
    define: {
      'import.meta.env.VITE_E2E_MODE': JSON.stringify(process.env.VITE_E2E_MODE || 'false'),
    },
    build: {
      modulePreload: {
        polyfill: false,
        resolveDependencies: (_filename, deps, context) => {
          if (
            context.hostType === 'js' &&
            context.hostId.includes('/src/features/census/components/SharedCensusView.tsx')
          ) {
            return deps.filter(
              dep =>
                !dep.includes('vendor-excel-zip') &&
                !dep.includes('ExcelParsingService-') &&
                !dep.includes('excelUtils-')
            );
          }

          return deps;
        },
      },
      rollupOptions: {
        output: {
          manualChunks: chunkForModule,
        },
      },
      // Keep warnings actionable: remaining heavy chunks are monolithic vendor libraries
      // (three/exceljs) already isolated behind lazy-loaded feature paths.
      chunkSizeWarningLimit: 950,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
        },
        mangle: {
          safari10: true,
        },
      },
      // Target modern browsers for smaller output
      target: 'es2020',
      // Enable source maps only in development
      sourcemap: !isProduction,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // Optimize dependencies - pre-bundle CommonJS packages for ESM compatibility
    optimizeDeps: {
      include: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
    },
  };
});
