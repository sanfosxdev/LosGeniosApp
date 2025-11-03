import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
        <div className="md:w-1/2 animate-slide-in-up">
          <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80" alt="Horno de pizza de leña" className="rounded-lg shadow-xl" />
        </div>
        <div className="md:w-1/2 animate-slide-in-up" style={{animationDelay: '200ms'}}>
          <h2 className="text-4xl font-bold font-display text-dark dark:text-gray-100 mb-4">Nuestra Historia</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Pizzería React nació de una idea simple: crear la mejor pizza usando solo los ingredientes más frescos y de origen local. Nuestra masa se hace a diario, nuestra salsa es una receta familiar transmitida por generaciones, y nuestra pasión se infunde en cada pizza que hacemos.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Creemos que una buena pizza une a la gente. Ya sea que estés compartiendo una comida con la familia o disfrutando una rebanada con amigos, estamos dedicados a hacer que tu experiencia sea inolvidable.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;