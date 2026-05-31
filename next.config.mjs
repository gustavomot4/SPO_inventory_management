/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: standalone gera bundle minimo para rodar em producao sem node_modules completo
  // Necessario para o build Docker multi-stage funcionar corretamente
  output: 'standalone',
}

export default nextConfig
