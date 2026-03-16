import fs from 'node:fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { chunkForModule } from './scripts/config/chunkingPolicy';

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
