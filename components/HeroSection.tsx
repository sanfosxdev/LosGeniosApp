import React from 'react';

interface HeroSectionProps {
  onOrderClick: () => void;
  isBotActive: boolean;
  isStoreOpen: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onOrderClick, isBotActive, isStoreOpen }) => {
  const getHeroText = () => {
    if (!isBotActive) {
      return "Hecha con pasión, horneada a la perfección. Explora nuestro menú y haz tu pedido.";
    }
    if (isStoreOpen) {
      return "Hecha con pasión, horneada a la perfección. ¡Deja que nuestro asistente de IA te ayude a encontrar tu pizza perfecta hoy!";
    }
    return "Hecha con pasión, horneada a la perfección. Aunque estamos cerrados, ¡nuestro asistente de IA puede ayudarte a reservar una mesa!";
  };
  
  return (
    <section id="home" className="relative h-[calc(100vh-80px)] min-h-[500px] bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80')" }}>
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-center items-center text-center text-white">
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold font-display animate-fade-in" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
          Pizza Auténtica, Una Rebanada a la Vez.
        </h2>
        <p className="mt-4 text-base sm:text-lg md:text-xl max-w-2xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {getHeroText()}
        </p>
        {isBotActive && (
          <button
            onClick={onOrderClick}
            className="mt-8 bg-secondary text-dark font-bold py-4 px-10 rounded-full text-lg hover:bg-yellow-500 transition-transform duration-300 ease-in-out transform hover:scale-105 animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            {isStoreOpen ? 'Pedir con Asistente IA' : 'Reservar con Asistente IA'}
          </button>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
