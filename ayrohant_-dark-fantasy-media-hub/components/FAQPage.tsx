import React from 'react';
import { faqData } from '../data';

const FAQPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-5xl font-cinzel font-bold text-[#e5c368] text-center mb-12">
        FAQ
      </h2>
      <div className="max-w-3xl mx-auto space-y-8">
        {faqData.map((item, index) => (
          <div key={index} className="border-l-4 border-[#e5c368] pl-6">
            <h3 className="text-xl font-bold font-cinzel text-gray-200 mb-2">{item.question}</h3>
            <p className="text-gray-400">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQPage;
