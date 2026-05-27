import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	server: {
		host: true,
		port: 1226,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['vue', 'vue-router', 'vue-i18n'],
					icons: ['@phosphor-icons/vue'],
				},
			},
		},
	},
});
