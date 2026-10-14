import { motion } from 'framer-motion';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="bg-ink text-cream py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            About MIVO
          </h1>
          <p className="text-2xl text-cream/80 leading-relaxed">
            Making Ideas into Visible Objects
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
          <div>
            <h2 className="text-4xl font-bold text-ink mb-6">Our Mission</h2>
            <p className="text-xl text-ink/80 leading-relaxed">
              At MIVO, we believe in the power of transformation — turning abstract
              ideas into tangible, physical objects. Through precision 3D printing
              technology and expert craftsmanship, we help individuals and businesses
              bring their visions to life.
            </p>
          </div>

          <div className="bg-lime/10 p-12 border-2 border-lime/20">
            <h2 className="text-4xl font-bold text-ink mb-6">What We Do</h2>
            <ul className="space-y-4 text-lg text-ink/80">
              <li className="flex items-start gap-3">
                <span className="text-lime text-2xl">✓</span>
                <span>Premium 3D printing services with multiple material options</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lime text-2xl">✓</span>
                <span>Custom CAD design and engineering support</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lime text-2xl">✓</span>
                <span>Rapid prototyping for product development</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-lime text-2xl">✓</span>
                <span>Small to large batch production</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-4xl font-bold text-ink mb-6">Quality First</h2>
            <p className="text-xl text-ink/80 leading-relaxed">
              Every project we undertake receives meticulous attention to detail.
              From material selection to finishing touches, we ensure that each
              piece meets our high standards of quality and precision.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
