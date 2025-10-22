import React, { useState } from 'react';
import { wikiData } from '../data';

const NecronomiconPage: React.FC = () => {
    const [activeTopicId, setActiveTopicId] = useState(wikiData[0]?.topics[0]?.id || '');

    const activeTopic = wikiData.flatMap(section => section.topics).find(topic => topic.id === activeTopicId);

    return (
        <div className="container mx-auto px-4 py-8">
            <h2 className="text-5xl font-cinzel font-bold text-[#e5c368] text-center mb-12">
                Некрономикон
            </h2>
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full md:w-1/4 lg:w-1/5">
                    <nav className="space-y-6">
                        {wikiData.map((section, index) => (
                            <div key={index}>
                                <h3 className="text-xl font-cinzel text-[#e5c368] mb-3 border-b border-white/10 pb-2">{section.title}</h3>
                                <ul className="space-y-2">
                                    {section.topics.map(topic => (
                                        <li key={topic.id}>
                                            <button 
                                                onClick={() => setActiveTopicId(topic.id)}
                                                className={`w-full text-left text-gray-400 hover:text-white transition-colors ${activeTopicId === topic.id ? 'text-white font-bold' : ''}`}
                                            >
                                                {topic.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>
                
                {/* Content */}
                <main className="w-full md:w-3/4 lg:w-4/5 bg-[#1a171c] border border-white/10 p-8 min-h-[60vh]">
                    {activeTopic ? (
                        <div>
                            <h1 className="text-4xl font-cinzel font-bold text-[#e5c368] mb-6">{activeTopic.title}</h1>
                            <div className="prose prose-invert max-w-none text-gray-300">
                                <p>{activeTopic.content}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400">Выберите тему для чтения.</p>
                    )}
                </main>
            </div>
        </div>
    );
};

export default NecronomiconPage;
