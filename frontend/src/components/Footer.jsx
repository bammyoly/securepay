import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Product: [
      { name: 'Solutions', href: '#solutions' },
      { name: 'Security', href: '#' },
      { name: 'FHE Technology', href: '#' },
      { name: 'Pricing', href: '#' },
    ],
    Resources: [
      { name: 'Whitepaper', href: '#' },
      { name: 'Documentation', href: '#' },
      { name: 'FAQs', href: '#faqs' },
      { name: 'Support', href: '#support' },
    ],
    Company: [
      { name: 'About Us', href: '#' },
      { name: 'Careers', href: '#' },
      { name: 'Privacy Policy', href: '#' },
      { name: 'Terms of Service', href: '#' },
    ],
  };

  return (
    <footer className="relative bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600
                flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                Secure<span className="text-indigo-600 dark:text-indigo-400">Pay</span>
              </span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed font-medium">
              The world's first confidential payroll protocol. 
              Built with Fully Homomorphic Encryption to ensure your financial data stays private on-chain.
            </p>
            <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Network Status: Operational
                </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6">
                {title}
              </h3>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.name}>
                    <a href={link.href} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Newsletter / Bottom Bar */}
        <div className="pt-12 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
          
          <div className="text-sm font-bold text-slate-500 dark:text-slate-500">
            © {currentYear} SecurePay Protocol. All rights reserved.
          </div>

          {/* Newsletter Input */}
          <div className="flex w-full md:w-auto items-center p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500/50 transition-all">
            <input 
              type="email" 
              placeholder="Updates to your inbox" 
              className="bg-transparent px-4 py-2 text-sm font-bold focus:outline-none w-full md:w-48 text-slate-900 dark:text-white placeholder:text-slate-500"
            />
            <button className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow-md active:scale-95">
              Join
            </button>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {['Twitter', 'Discord', 'Github'].map((social) => (
              <a 
                key={social} 
                href="#" 
                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
              >
                <span className="sr-only">{social}</span>
                {/* Icons placeholder - can swap for lucide or simple svgs */}
                <div className="w-5 h-5 bg-current opacity-20 rounded-sm"></div>
              </a>
            ))}
          </div>

        </div>
      </div>

      {/* Subtle bottom gradient line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 opacity-50"></div>
    </footer>
  );
};

export default Footer;