import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './components/ThemeContext.jsx'

// Import the shared wagmi config — Arbitrum Sepolia + Sepolia
import { config } from './wagmiConfig.js'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider
          chains={[arbitrumSepolia, sepolia]}
          initialChain={arbitrumSepolia}
        >
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </BrowserRouter>
)