import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  // Hardcoded SVG Paths to ensure 100% visibility without external dependencies
  const Logotypes = [
    { 
      name: "POLYGON", 
      svg: <svg className="h-7 w-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 4.5 12 3 9.5 4.5v3L12 9l2.5-1.5v-3zM12 21l-2.5-1.5v-3L12 15l2.5 1.5v3L12 21zM22 10.5 19.5 9l-2.5 1.5v3l2.5 1.5 2.5-1.5v-3zM7 10.5 4.5 9 2 10.5v3L4.5 15 7 13.5v-3z"/></svg> 
    },
    { 
      name: "COINBASE", 
      svg: <svg className="h-6 w-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.462c-3.569 0-6.462-2.893-6.462-6.462S8.431 5.538 12 5.538s6.462 2.893 6.462 6.462-2.893 6.462-6.462 6.462z"/></svg> 
    },
    { 
      name: "BINANCE", 
      svg: <svg className="h-7 w-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M16.624 13.92 19.341 16.636 11.988 23.989 4.636 16.637 7.353 13.92 11.989 18.58 16.624 13.92Zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716Zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715Zm-9.273 0L5.41 12l-2.693 2.716L0 12l2.716-2.716ZM11.988 0l7.352 7.352-2.717 2.717-4.635-4.66-4.636 4.66-2.717-2.717L11.988 0Z"/></svg> 
    },
    { 
      name: "AAVE", 
      svg: <svg className="h-7 w-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm.182 5.25h-.355c-.444 0-.78.257-1.006.782l-1.745 4.422h-1.32c-.396 0-.717.336-.72.75v.01c.003.415.324.75.72.751h.71l-1.666 4.216a.926.926 0 00-.05.288c0 .236.069.421.197.565.128.144.305.216.533.216a.7.7 0 00.414-.144.81.81 0 00.285-.38l1.693-4.286h3.555l1.692 4.286c.068.154.158.288.285.38a.7.7 0 00.414.144c.228 0 .405-.072.533-.216.128-.144.197-.329.197-.565 0-.1-.016-.197-.05-.288l-1.666-4.216h.71c.396-.001.717-.336.72-.751v-.01c-.003-.414-.324-.75-.72-.75h-1.32L13.194 6.03c-.226-.525-.562-.782-1.006-.782h-.006zM12 8.427l1.091 2.777h-2.182L12 8.427z"/></svg> 
    }
  ];

  return (
    <div className="min-h-screen pt-16 transition-colors duration-300 
      bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      
      {/* Decorative Background Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] opacity-20 dark:opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent"></div>
      </div>

      <main className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="mb-8 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase 
          bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
          Powered by Fhenix FHE
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 
          bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 
          dark:from-white dark:to-slate-400">
          On-chain Payroll. <br className="hidden md:block" />
          Off-chain Privacy.
        </h1>

        <p className="max-w-2xl text-lg lg:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
          The first payroll protocol secured by Fully Homomorphic Encryption. 
          Send salaries that are verifiable on the blockchain but invisible to the public.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/login" className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold 
            hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/25">
            Go To App
          </Link>
          <button className="px-8 py-4 rounded-2xl font-bold border border-slate-200 dark:border-slate-800 
            bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Read Whitepaper
          </button>
        </div>

        {/* --- NEW SECTION: Teams that Trust Us (Enhanced Logo Slide) --- */}
        <div className="w-full mt-32 py-12 border-y border-slate-200/50 dark:border-slate-800/50 overflow-hidden relative">
          <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-12">
            Teams that Trust Us
          </h2>
          
          <div className="flex w-[200%] animate-infinite-scroll group">
            {/* Double the array for infinite effect */}
            {[...Logotypes, ...Logotypes, ...Logotypes].map((logo, i) => (
              <div key={i} className="flex items-center gap-4 px-12 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all cursor-default text-slate-700 dark:text-slate-300">
                <div className="text-indigo-600 dark:text-indigo-400">
                    {logo.svg}
                </div>
                <span className="text-2xl font-black tracking-tighter">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { 
              title: "Encrypted Math", 
              desc: "Run payroll logic on encrypted data using Fhenix FHE. No decryption needed for computation." 
            },
            { 
              title: "Leak-Proof", 
              desc: "Individual salaries, bonus structures, and wallet links are shielded from block explorers." 
            },
            { 
              title: "EVM Compatible", 
              desc: "Seamlessly integrates with your existing Ethereum ecosystem while adding privacy layers." 
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 
              bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* --- NEW SECTION: Gradient Call to Action --- */}
        <section className="mt-40 w-full p-12 md:p-24 rounded-[48px] 
          bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white text-center 
          overflow-hidden relative shadow-2xl shadow-indigo-500/40">
            
            {/* Large Decorative Glow */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-[100px]"></div>
            
            <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">Ready to secure your payroll?</h2>
                <p className="text-indigo-100 mb-12 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-medium opacity-90">
                    Join the next generation of private financial infrastructure. 
                    Scalable, encrypted, and built on Fhenix.
                </p>
                <Link to="/login" className="px-12 py-5 rounded-2xl bg-white text-indigo-700 font-black text-lg
                    hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95 shadow-2xl">
                    Get Started Now
                </Link>
            </div>
        </section>

      </main>

      {/* --- Keyframe Animation --- */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes infinite-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-infinite-scroll {
          animation: infinite-scroll 40s linear infinite;
        }
      `}} />
    </div>
  );
};

export default Home;