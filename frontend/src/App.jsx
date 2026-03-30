import React from 'react'
import Navbar from './components/Navbar'
import RouterConfig from './routes/RouterConfig'
import Footer from './components/Footer'

const App = () => {
  return (
    <>
        <Navbar onLogout={() => setUser(null)} />
        <RouterConfig />
        <Footer />
    </>
  )
}

export default App
