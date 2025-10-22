
import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="py-16 text-center">
      <div className="container mx-auto px-4">
        <h2 className="text-5xl font-cinzel font-bold text-[#e5c368]">
          Скетчбук Элазара
        </h2>
        <p className="mt-4 text-gray-400">
          Подвал 2D художника
        </p>
        <div className="mt-6 w-32 h-1 mx-auto bg-gradient-to-r from-[#d13a69] to-[#e5c368]"></div>
      </div>
    </section>
  );
};

export default Hero;
