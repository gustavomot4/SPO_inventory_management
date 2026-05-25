/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' gera um build auto-suficiente em .next/standalone/
  // necessário para o Dockerfile multi-stage (ADR-004)
  // inclui apenas dependências de produção — reduz significativamente o tamanho da imagem
  output: 'standalone',
}

export default nextConfig
