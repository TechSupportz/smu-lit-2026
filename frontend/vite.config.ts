import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
 plugins: [react(),tailwindcss()],
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 server:{
  allowedHosts:['assumed-gratuit-rider-merchandise.trycloudflare.com'],
  proxy:{'/api':{target:'http://127.0.0.1:3000',changeOrigin:true,rewrite:path=>path.replace(/^\/api/,'')}},
 },
})
