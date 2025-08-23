import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MedEssenceAI | Med-Essence',
  description: 'AI-powered medical transcription and reporting system by Med-Essence',
  keywords: 'medical, AI, transcription, reporting, med-essence, radiology',
  authors: [{ name: 'Med-Essence' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e293b" />
        <link rel="icon" href="/favicon.png" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-navy-50 to-orange-50">
          <header className="bg-gradient-to-r from-navy-800 to-navy-700 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-20">
                <div className="flex items-center space-x-4">
                  <img 
                    src="/mdlogo.svg" 
                    alt="MedEssenceAI" 
                    className="h-12 w-auto"
                  />
                  <div className="hidden sm:block h-8 w-px bg-white/30"></div>
                  <div className="text-white">
                    <h1 className="text-2xl font-bold tracking-tight">
                      MedEssenceAI
                    </h1>
                    <p className="text-sm text-navy-100 -mt-1">
                      AI-Powered Medical Analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-white/90">
                    Medical Professional Dashboard
                  </div>
                  <div className="hidden sm:flex items-center text-xs text-white/80">
                    <span className="px-3 py-1.5 bg-orange-500/20 border border-orange-400/30 rounded-full text-orange-100">
                      Enhanced Findings • ICD-10-GM • Multi-LLM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}