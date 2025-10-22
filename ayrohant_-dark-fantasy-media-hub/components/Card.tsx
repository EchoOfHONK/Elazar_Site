import React from 'react';
import type { CardData, CardAction } from '../types';

interface CardProps {
  data: CardData;
  onClick: (action: CardAction) => void;
}

const Card: React.FC<CardProps> = ({ data, onClick }) => {
  return (
    <div className="bg-[#1a171c] p-6 border border-white/10 relative flex flex-col justify-between min-h-[220px]">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d13a69] to-[#e5c368]"></div>
      <div>
        <h3 className="text-xl font-bold font-cinzel text-[#e5c368] mb-3">{data.title}</h3>
        <p className="text-gray-400 text-sm">{data.description}</p>
      </div>
      <button 
        onClick={() => onClick(data.action)}
        className="mt-6 self-start px-6 py-2 font-bold text-black uppercase tracking-widest text-sm bg-gradient-to-r from-[#d13a69] to-[#e5c368] hover:opacity-90 transition-opacity duration-300">
        {data.buttonText}
      </button>
    </div>
  );
};

export default Card;
