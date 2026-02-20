import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Custom plugin to generate version.json on each build.
 * This enables automatic cache invalidation when deploying new versions.
 */
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    buildStart() {
      const version = Date.now().toString();
      const versionInfo = {
        version,
        buildDate: new Date().toISOString(),
      };

      // Ensure public directory exists
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      // Write version.json
      fs.writeFileSync(
        path.resolve(publicDir, 'version.json'),
        JSON.stringify(versionInfo, null, 2)
      );

      console.log(`[versionPlugin] Generated version.json: ${version}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const chunkForModule = (moduleId: string): string | undefined => {
    const normalizedId = moduleId.replace(/\\/g, '/');
    const inNodeModules = normalizedId.includes('/node_modules/');
    const has = (fragment: string): boolean => normalizedId.includes(fragment);

    if (inNodeModules) {
      // Keep React together with UI libs that depend on it
      if (
        has('/node_modules/react/') ||
        has('/node_modules/react-dom/') ||
        has('/node_modules/lucide-react/')
      ) {
        return 'vendor-react';
      }

      // Keep Firebase in a single vendor chunk to avoid cross-chunk init cycles
      // between firebase-core/firestore that can break runtime execution order.
      if (has('/node_modules/firebase/') || has('/node_modules/@firebase/')) {
        return 'vendor-firebase';
      }

      // HTML to Canvas (lazy loaded for screenshots)
      if (has('/node_modules/html2canvas/')) {
        return 'vendor-canvas';
      }

      // 3D map stack: split into focused chunks to avoid one near-limit artifact.
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
      if (has('/node_modules/exceljs/')) {
        return 'vendor-excel-core';
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
      // Keep lazy routes truly on-demand; avoid eager dependency preloading
      // that can pull large optional chunks on first load.
      modulePreload: false,
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
      include: [
        'react',
        'react-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'exceljs',
      ],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
    },
  };
});
