import React from 'react';
import type { Page } from '../App';

const navItems: { label: string; page: Page }[] = [
  { label: 'ХРОНИКИ', page: 'home' },
  { label: 'САГИ', page: 'sagas' },
  { label: 'БАЛЛАДЫ', page: 'ballads' },
  { label: 'СВИТКИ С КАРТИНКАМИ', page: 'scrolls' },
  { label: 'FAQ', page: 'faq' },
  { label: 'НЕКРОНОМИКОН', page: 'necronomicon' },
];

interface HeaderProps {
  onNavigate: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  return (
    <header className="py-6 border-b border-white/10">
      <div className="container mx-auto flex justify-between items-center px-4">
        <button onClick={() => onNavigate('home')} className="focus:outline-none">
          <h1 className="text-3xl font-cinzel font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#d13a69] to-[#e5c368]">
            Elazar's Sketchbook
          </h1>
        </button>
        <nav className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              className="text-sm text-gray-300 hover:text-[#e5c368] transition-colors duration-300 tracking-wider"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
