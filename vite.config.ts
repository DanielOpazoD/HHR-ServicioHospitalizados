import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
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
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';
  const chunkForModule = (moduleId: string): string | undefined => {
    const normalizedId = moduleId.replace(/\\/g, '/');

    if (normalizedId.includes('/node_modules/')) {
      // Keep React together with UI libs that depend on it
      if (
        normalizedId.includes('/node_modules/react/') ||
        normalizedId.includes('/node_modules/react-dom/') ||
        normalizedId.includes('/node_modules/lucide-react/')
      ) {
        return 'vendor-react';
      }

      // Firebase split by domain to avoid a single oversized chunk
      if (normalizedId.includes('/node_modules/@firebase/firestore/')) {
        return 'vendor-firebase-firestore';
      }
      if (normalizedId.includes('/node_modules/@firebase/auth/')) {
        return 'vendor-firebase-auth';
      }
      if (normalizedId.includes('/node_modules/@firebase/storage/')) {
        return 'vendor-firebase-storage';
      }
      if (
        normalizedId.includes('/node_modules/firebase/') ||
        normalizedId.includes('/node_modules/@firebase/')
      ) {
        return 'vendor-firebase-core';
      }

      // 3D stack for floor map (split to avoid a single giant vendor chunk)
      if (normalizedId.includes('/node_modules/three/examples/')) {
        return 'vendor-three-examples';
      }
      if (normalizedId.includes('/node_modules/three/')) {
        return 'vendor-three-core';
      }
      if (normalizedId.includes('/node_modules/@react-three/fiber/')) {
        return 'vendor-r3f';
      }
      if (normalizedId.includes('/node_modules/@react-three/drei/')) {
        return 'vendor-drei';
      }

      // Charts separate (lazy loaded)
      if (normalizedId.includes('/node_modules/recharts/')) {
        return 'vendor-charts';
      }

      // Excel/Reports (lazy loaded)
      if (
        normalizedId.includes('/node_modules/exceljs/') ||
        normalizedId.includes('/node_modules/file-saver/')
      ) {
        return 'vendor-excel';
      }

      // PDF generation (lazy loaded)
      if (
        normalizedId.includes('/node_modules/jspdf/') ||
        normalizedId.includes('/node_modules/jspdf-autotable/')
      ) {
        return 'vendor-pdf';
      }

      // DOCX/XLSX helpers for transfer bundles
      if (normalizedId.includes('/node_modules/docxtemplater/')) {
        return 'vendor-docxtemplater';
      }
      if (normalizedId.includes('/node_modules/docx/')) {
        return 'vendor-docx';
      }
      if (normalizedId.includes('/node_modules/pizzip/')) {
        return 'vendor-pizzip';
      }
      if (normalizedId.includes('/node_modules/xlsx-populate/')) {
        return 'vendor-xlsx-populate';
      }

      // HTML to Canvas (lazy loaded for screenshots)
      if (normalizedId.includes('/node_modules/html2canvas/')) {
        return 'vendor-canvas';
      }
    }

    // Split heavy internal features for better cacheability and lower entry chunk pressure
    if (normalizedId.includes('/src/features/census/components/3d/')) {
      return 'feature-census-3d';
    }
    if (normalizedId.includes('/src/features/cudyr/')) {
      return 'feature-cudyr';
    }
    if (normalizedId.includes('/src/features/handoff/')) {
      return 'feature-handoff';
    }
    if (normalizedId.includes('/src/features/transfers/')) {
      return 'feature-transfers';
    }
    if (
      normalizedId.includes('/src/features/admin/components/components/audit/') ||
      normalizedId.includes('/src/features/admin/components/Audit') ||
      normalizedId.includes('/src/features/admin/components/auditConstants')
    ) {
      return 'feature-admin-audit';
    }
    if (
      normalizedId.includes('/src/features/admin/components/PatientMasterView') ||
      normalizedId.includes('/src/features/admin/components/components/Patient')
    ) {
      return 'feature-admin-patient';
    }
    if (
      normalizedId.includes('/src/features/admin/components/DataMaintenanceView') ||
      normalizedId.includes('/src/features/admin/components/components/DataMaintenance') ||
      normalizedId.includes('/src/features/admin/components/components/DataImportModal') ||
      normalizedId.includes('/src/features/admin/components/components/SyncPanel') ||
      normalizedId.includes('/src/features/admin/components/components/ConflictPanel')
    ) {
      return 'feature-admin-maintenance';
    }
    if (
      normalizedId.includes('/src/features/admin/components/RoleManagementView') ||
      normalizedId.includes('/src/features/admin/components/components/Role') ||
      normalizedId.includes('/src/features/admin/components/components/DeleteRoleModal')
    ) {
      return 'feature-admin-roles';
    }
    if (
      normalizedId.includes('/src/features/admin/components/SystemDiagnosticsView') ||
      normalizedId.includes('/src/features/admin/components/SystemHealthDashboard') ||
      normalizedId.includes('/src/features/admin/components/DevDashboard') ||
      normalizedId.includes('/src/features/admin/components/AITelemetryPanel')
    ) {
      return 'feature-admin-diagnostics';
    }
    if (normalizedId.includes('/src/features/admin/components/ErrorDashboard')) {
      return 'feature-admin-errors';
    }
    if (normalizedId.includes('/src/features/admin/components/MedicalSignatureView')) {
      return 'feature-admin-signature';
    }
    if (normalizedId.includes('/src/features/admin/components/CensusAccessManager')) {
      return 'feature-admin-census-access';
    }
    if (normalizedId.includes('/src/features/admin/')) {
      return 'feature-admin-core';
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
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY
      ),
      'import.meta.env.VITE_API_KEY': JSON.stringify(
        env.VITE_API_KEY || env.API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY
      ),
      'import.meta.env.VITE_E2E_MODE': JSON.stringify(process.env.VITE_E2E_MODE || 'false'),
    },
    build: {
      modulePreload: {
        // Do not eagerly preload very large optional libraries.
        // They are still fetched when their lazy route/action is actually executed.
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            dep =>
              !dep.includes('vendor-excel') &&
              !dep.includes('vendor-three-core') &&
              !dep.includes('vendor-drei') &&
              !dep.includes('vendor-r3f')
          ),
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
