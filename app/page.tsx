'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    async function fetchFeatured() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('published', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(3);

      setFeaturedProducts(data || []);
    }

    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <HeroSection />
      <HowMIVOWorksSection />
      <WhatWeMakeSection />
      <FeaturedModelsSection products={featuredProducts} />
      <ContactCTA />
    </div>
  );
}

// Hero Section - Matching reference exactly
function HeroSection() {
  return (
    <section className="relative bg-cream pt-24 pb-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[540px]">
          {/* Left: Headline and CTAs */}
          <div className="relative z-10">
            {/* Handwritten annotation */}
            <div className="mb-2">
              <svg className="w-48 h-14" viewBox="0 0 200 80" fill="none">
                <text
                  x="10"
                  y="20"
                  className="text-xs"
                  fill="#101010"
                  fontFamily="sans-serif"
                  fontSize="10"
                >
                  IDEAS
                </text>
                <text
                  x="10"
                  y="35"
                  className="text-xs"
                  fill="#101010"
                  fontFamily="sans-serif"
                  fontSize="10"
                >
                  SKETCHES
                </text>
                <text
                  x="10"
                  y="50"
                  className="text-xs"
                  fill="#101010"
                  fontFamily="sans-serif"
                  fontSize="10"
                >
                  PROJECTS
                </text>
                <text
                  x="10"
                  y="65"
                  className="text-xs"
                  fill="#101010"
                  fontFamily="sans-serif"
                  fontSize="10"
                >
                  PROBLEMS
                </text>
                <path
                  d="M 65 40 Q 120 20 180 60"
                  stroke="#101010"
                  strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#101010" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Main headline with handwritten style */}
            <h1 className="mb-5 leading-tight font-handwritten">
              <span className="block text-5xl md:text-6xl lg:text-7xl font-bold text-ink mb-2">
                Your ideas.
              </span>
              <span className="relative inline-block">
                <span className="block text-5xl md:text-6xl lg:text-7xl font-bold text-ink relative z-10">
                  Designed.
                </span>
                {/* Yellow marker highlight */}
                <div className="absolute inset-0 -left-2 -right-2 top-2 bottom-0 bg-yellow opacity-60 -rotate-1 rounded-lg -z-0"></div>
              </span>
              <span className="block text-5xl md:text-6xl lg:text-7xl font-bold text-ink mt-2">
                Made real.
              </span>
            </h1>

            {/* Supporting text */}
            <p className="text-lg md:text-xl text-ink/80 mb-4 max-w-lg leading-relaxed">
              3D printing, CAD design, rapid prototyping and custom parts for students, engineers and businesses in
              Vijayawada.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/explore">
                <Button variant="accent" size="lg" className="min-w-[200px] text-base font-bold rounded-xl">
                  Explore Models
                  <svg className="ml-2 w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </Link>
              <Link href="/custom">
                <Button variant="secondary" size="lg" className="min-w-[220px] text-base rounded-xl">
                  Start a Custom Project
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: 3D printing showcase */}
          <div className="relative">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_24px_60px_rgba(16,16,16,0.08)]">
              <Image
                src="/bambu-a1-printing-gear.png"
                alt="A lime-green gear being made from a digital design"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="relative z-10 object-cover object-center drop-shadow-[0_18px_20px_rgba(16,16,16,0.18)]"
              />

              <div className="absolute bottom-5 left-5 z-20 rounded-full bg-lime px-3 py-2 shadow-lg sm:bottom-7 sm:left-7">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink">CAD → Print</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Step Card Component
function StepCard({ step }: { step: any }) {
  return (
    <div className="h-full">
      {/* Number badge */}
      <div className="w-16 h-16 bg-lime rounded-full flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-ink">{step.number}</span>
      </div>

      {/* Image with curved border */}
      <div className="relative h-48 mb-6 bg-white rounded-3xl p-4 border border-ink/10 shadow-md overflow-hidden">
        <Image
          src={step.image}
          alt={step.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-2"
        />
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold font-handwritten text-ink mb-3">{step.title}</h3>

      {/* Description */}
      <p className="text-ink/70 leading-relaxed">{step.description}</p>
    </div>
  );
}

// How MIVO Works Section
function HowMIVOWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Share Your Idea',
      description: 'Send us your sketch, file or just an idea.',
      image: '/services/idea-sketch.webp',
      imageAlt: 'Hand sketching a mechanical part from an idea',
    },
    {
      number: '2',
      title: 'We Design',
      description: 'We create or refine the 3D model.',
      image: '/services/cad-design.webp',
      imageAlt: 'Laptop displaying a 3D CAD bracket design',
    },
    {
      number: '3',
      title: 'We Print',
      description: 'High quality 3D printing with the right material.',
      image: '/services/3d-printing.webp',
      imageAlt: '3D printer making a lime-green bracket',
    },
    {
      number: '4',
      title: 'You Get It',
      description: 'Receive your custom part ready to use.',
      image: '/services/custom-parts.webp',
      imageAlt: 'Finished custom 3D printed mechanical parts',
    },
  ];

  return (
    <section className="py-20 bg-cream border-t border-ink/10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section heading with annotation */}
        <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="inline-flex items-center gap-3">
            {/* Handwritten annotation */}
            <div className="hidden md:block">
              <svg width="110" height="85" viewBox="0 0 110 85">
                <text x="0" y="14" fill="#101010" fontFamily="sans-serif" fontSize="10" fontWeight="400">
                  A SIMPLE
                </text>
                <text x="0" y="28" fill="#101010" fontFamily="sans-serif" fontSize="10" fontWeight="400">
                  PROCESS
                </text>
                <text x="0" y="42" fill="#101010" fontFamily="sans-serif" fontSize="10" fontWeight="400">
                  TO BRING
                </text>
                <text x="0" y="56" fill="#101010" fontFamily="sans-serif" fontSize="10" fontWeight="400">
                  YOUR IDEAS
                </text>
                <text x="0" y="70" fill="#101010" fontFamily="sans-serif" fontSize="10" fontWeight="400">
                  TO LIFE.
                </text>
                <path d="M 75 42 C 85 32, 95 35, 105 42" stroke="#101010" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-process)" />
                <defs>
                  <marker
                    id="arrow-process"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#101010" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Main heading */}
            <div>
              <h2 className="text-5xl md:text-6xl font-bold font-handwritten text-ink relative inline-block">
                How MIVO
                <br />
                Works?
                <div className="absolute -bottom-2 left-0 w-[260px] h-3 bg-yellow opacity-60 -rotate-1"></div>
              </h2>
            </div>
          </div>

          <div className="max-w-xl border-l-[3px] border-lime pl-5 md:mb-1 md:pl-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/50">
              Thoughtful from start to finish
            </p>
            <p className="mt-2 max-w-lg font-handwritten text-2xl leading-snug text-ink md:text-3xl">
              More than a print—a practical solution shaped around your idea.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink/65">
              <span>Design guidance</span>
              <span>Material options</span>
              <span>Made for your project</span>
            </div>
          </div>
        </div>

        {/* Process steps - S-Curve Zigzag Journey */}
        <div className="relative rounded-3xl border-2 border-ink/10 bg-cream p-8 md:p-12 lg:p-16 overflow-hidden">
          {/* Zigzag flow arrows (desktop) - Dynamic journey visualization */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
              {/* Arrow 1 → 2: Top-left to middle-right (diagonal down-right) */}
              <g>
                <path
                  d="M 230 150 Q 360 200 490 250"
                  stroke="#101010"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                  fill="none"
                  strokeLinecap="round"
                />
                <polygon points="488,245 498,250 488,255" fill="#101010" />
                <path
                  d="M355,185 L358,193 L367,195 L360,201 L362,210 L355,205 L348,210 L350,201 L343,195 L352,193 Z"
                  fill="#FFD400"
                />
                <line x1="365" y1="205" x2="373" y2="213" stroke="#FFD400" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Arrow 2 → 3: Middle-right to bottom-left (diagonal down-left) */}
              <g>
                <path
                  d="M 510 370 Q 380 440 250 500"
                  stroke="#101010"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                  fill="none"
                  strokeLinecap="round"
                />
                <polygon points="252,495 242,500 252,505" fill="#101010" />
                <path
                  d="M385,405 L388,413 L397,415 L390,421 L392,430 L385,425 L378,430 L380,421 L373,415 L382,413 Z"
                  fill="#FFD400"
                />
                <line x1="395" y1="425" x2="403" y2="433" stroke="#FFD400" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Arrow 3 → 4: Bottom-left to bottom-right (curved across) */}
              <g>
                <path
                  d="M 230 570 Q 360 600 490 580"
                  stroke="#101010"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                  fill="none"
                  strokeLinecap="round"
                />
                <polygon points="488,575 498,580 488,585" fill="#101010" />
                <path
                  d="M360,590 L363,598 L372,600 L365,606 L367,615 L360,610 L353,615 L355,606 L348,600 L357,598 Z"
                  fill="#FFD400"
                />
                <line x1="370" y1="610" x2="378" y2="618" stroke="#FFD400" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </svg>
          </div>

          {/* Zigzag layout - responsive */}
          <div className="relative space-y-12 lg:space-y-0">
            {/* Row 1: Steps 1 and 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-0 lg:mb-32">
              {/* Step 1 - Top Left */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative z-10"
              >
                <StepCard step={steps[0]} />
              </motion.div>

              {/* Step 2 - Middle Right (pushed down) */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative z-10 lg:mt-24"
              >
                <StepCard step={steps[1]} />
              </motion.div>
            </div>

            {/* Row 2: Steps 3 and 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
              {/* Step 3 - Bottom Left */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="relative z-10"
              >
                <StepCard step={steps[2]} />
              </motion.div>

              {/* Step 4 - Bottom Right */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="relative z-10 lg:mt-12"
              >
                <StepCard step={steps[3]} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// What We Make Section
function WhatWeMakeSection() {
  const services = [
    {
      title: '3D Printing',
      description: 'High quality FDM printing with PLA, PETG, TPU and more.',
      image: '/services/3d-printing.webp',
      imageAlt: 'Technical illustration of a 3D printer making a bracket',
      link: '/custom',
    },
    {
      title: 'CAD Design',
      description: 'Professional 3D modeling and design support.',
      image: '/services/cad-design.webp',
      imageAlt: 'Technical illustration of a laptop showing a CAD model',
      link: '/custom',
    },
    {
      title: 'Prototyping',
      description: 'Test your ideas with functional prototypes.',
      image: '/services/prototyping.webp',
      imageAlt: 'Technical illustration of a prototype electronics enclosure',
      link: '/custom',
    },
    {
      title: 'Custom Parts',
      description: 'Replacement parts, jigs, fixtures and custom components.',
      image: '/services/custom-parts.webp',
      imageAlt: 'Technical illustration of custom 3D printed components',
      link: '/custom',
    },
  ];

  return (
    <section className="py-20 bg-cream border-t border-ink/10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section heading */}
        <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-8">
            {/* Annotation */}
            <div className="hidden md:block">
              <svg width="120" height="80" viewBox="0 0 120 80">
                <text x="10" y="20" fill="#101010" fontFamily="sans-serif" fontSize="10">
                  SOLUTIONS
                </text>
                <text x="10" y="35" fill="#101010" fontFamily="sans-serif" fontSize="10">
                  FOR REAL
                </text>
                <text x="10" y="50" fill="#101010" fontFamily="sans-serif" fontSize="10">
                  PROBLEMS
                </text>
                <path d="M 60 40 Q 100 20 160 50" stroke="#101010" strokeWidth="1.5" fill="none" />
              </svg>
            </div>

            {/* Heading */}
            <div>
              <h2 className="text-5xl md:text-6xl font-bold font-handwritten text-ink mb-4 relative inline-block">
                What
                <br />
                We Make
                <div className="absolute -bottom-2 left-0 right-24 h-3 bg-yellow opacity-60 rotate-1"></div>
              </h2>
            </div>
          </div>

          <div className="max-w-xl border-l-[3px] border-lime pl-5 md:mb-1 md:pl-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/50">
              Made for real projects
            </p>
            <p className="mt-2 font-handwritten text-2xl leading-snug text-ink md:text-3xl">
              From a first idea to a part you can use.
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-ink/65">
              Printing, CAD design, prototyping and custom parts for students, makers and businesses.
            </p>
          </div>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group"
            >
              <Link href={service.link}>
                <div className="bg-cream border-2 border-ink/10 rounded-2xl p-6 hover:border-lime hover:shadow-lg transition-all duration-300 h-full cursor-pointer">
                  <div className="aspect-square bg-cream rounded-xl mb-6 relative overflow-hidden">
                    <Image
                      src={service.image}
                      alt={service.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold font-handwritten text-ink mb-3 group-hover:text-lime transition-colors">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-ink/70 leading-relaxed mb-4">{service.description}</p>

                  {/* Arrow */}
                  <div className="flex items-center text-ink group-hover:text-lime transition-colors">
                    <svg
                      className="w-6 h-6 transform group-hover:translate-x-2 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>

                  {/* Checkmark accent */}
                  {index === 3 && (
                    <div className="absolute top-4 right-4">
                      <svg width="30" height="30" viewBox="0 0 30 30">
                        <circle cx="15" cy="15" r="14" fill="#B7FF2A" opacity="0.3" />
                        <path d="M 8 15 L 13 20 L 22 11" stroke="#B7FF2A" strokeWidth="2.5" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Featured Models Section
function FeaturedModelsSection({ products }: { products: any[] }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-20 bg-ink text-cream border-y border-cream/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready-to-Order Models</h2>
          <p className="text-xl text-cream/70 mb-8">Browse our collection of pre-designed 3D printed parts</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {products.slice(0, 3).map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Link href={`/product/${product.id}`}>
                <div className="group cursor-pointer">
                  <div className="aspect-square bg-cream/5 rounded-xl mb-4 relative overflow-hidden border border-cream/10 group-hover:border-lime transition-colors duration-300">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${product.images[0]}`}
                        alt={product.name}
                        fill
                        className="object-contain p-8"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-6xl">📦</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-lime transition-colors">{product.name}</h3>
                  <p className="text-cream/60 text-sm mb-3">{product.category}</p>
                  <p className="text-2xl font-bold">₹{product.price}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/explore">
            <Button variant="accent" size="lg">
              View All Models
              <svg className="ml-2 w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// Contact CTA
function ContactCTA() {
  return (
    <section className="py-20 bg-cream border-t border-ink/10">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold font-handwritten text-ink mb-6">Ready to bring your idea to life?</h2>
        <p className="text-xl text-ink/70 mb-10">Get in touch and let's discuss your project</p>
        <Link href="/contact">
          <Button variant="accent" size="lg" className="min-w-[200px] rounded-xl">
            Get a Quote
            <svg className="ml-2 w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        </Link>
      </div>
    </section>
  );
}
