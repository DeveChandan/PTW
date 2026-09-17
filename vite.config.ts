import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on current mode
  const env = loadEnv(mode, process.cwd(), '');

  const sapTarget = env.VITE_SAP_TARGET || 'https://vhgfldevci.sap.gfl.co.in:44300';
  const sapClient = env.VITE_SAP_CLIENT || '100';

  return {
    plugins: [react()],
    // CRITICAL FOR SAP BSP:
    // Forces all asset references (<script src="./assets/...">) to be relative.
    // In SAP BSP, the app is served under /sap/bc/bsp/sap/<app_name>/
    base: './',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@core': path.resolve(__dirname, './src/core'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@features': path.resolve(__dirname, './src/features')
      }
    },

    server: {
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
        // Proxy SAP OData V4 Services
        '/sap/opu/odata4': {
          target: sapTarget,
          changeOrigin: true,
          secure: false, // Set to true if using valid corporate SSL certificates
          headers: {
            'sap-client': sapClient
          }
        },
        // Proxy SAP User Info and Fiori Launchpad Services
        '/sap/bc/ui2': {
          target: sapTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            'sap-client': sapClient
          }
        },
        // Proxy generic SAP ICF services (MIME repository, authentication)
        '/sap/bc': {
          target: sapTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            'sap-client': sapClient
          }
        }
      }
    },

    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          // Keep chunk filenames clean and predictable for SAP MIME repository
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  };
});
