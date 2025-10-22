import React from 'react';
import type { CardData, CardAction } from '../types';
import Card from './Card';

interface ContentGridProps {
  cards: CardData[];
  onCardClick: (action: CardAction) => void;
}

const ContentGrid: React.FC<ContentGridProps> = ({ cards, onCardClick }) => {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cards.slice(0, 3).map((card, index) => (
          <Card key={index} data={card} onClick={onCardClick} />
        ))}
        {cards.length > 3 && (
            <div className="md:col-span-2 lg:col-start-1 lg:col-span-1">
                 <Card data={cards[3]} onClick={onCardClick} />
            </div>
        )}
      </div>
    </main>
  );
};

export default ContentGrid;
