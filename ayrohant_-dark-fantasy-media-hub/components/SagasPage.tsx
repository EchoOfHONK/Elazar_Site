import React from 'react';
import { mangaData } from '../data';

interface SagasPageProps {
  onMangaSelect: (mangaId: string) => void;
}

const SagasPage: React.FC<SagasPageProps> = ({ onMangaSelect }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-5xl font-cinzel font-bold text-[#e5c368] text-center mb-12">
        Саги
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
        {mangaData.map((manga) => (
          <div
            key={manga.id}
            className="group cursor-pointer"
            onClick={() => onMangaSelect(manga.id)}
          >
            <div className="aspect-[5/7] overflow-hidden border-2 border-transparent group-hover:border-[#e5c368] transition-all duration-300">
              <img
                src={manga.cover}
                alt={manga.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <h3 className="mt-4 text-center font-cinzel text-lg text-gray-300 group-hover:text-white transition-colors">
              {manga.title}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SagasPage;
