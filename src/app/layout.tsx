import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pimenta Ousada — Sistema de Estoque',
  description: 'Sistema de gestão de estoque para a loja Pimenta Ousada',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}
