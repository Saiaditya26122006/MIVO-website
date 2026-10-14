# MIVO Website

**Making Ideas into Visible Objects**

A premium 3D printing and custom manufacturing website built with Next.js 15, React 19, Tailwind CSS 4, and Framer Motion.

## 🎨 Brand Identity

- **Brand Name:** MIVO
- **Tagline:** Making Ideas into Visible Objects
- **Location:** Vijayawada, Andhra Pradesh, India

### Brand Colors

- **Ink Black:** `#101010` - Primary text and dark backgrounds
- **Warm Cream:** `#FFF8E8` - Primary background
- **Lime Punch:** `#B7FF2A` - Accent color for CTAs and highlights
- **Citrus Yellow:** `#FFD400` - Secondary accent
- **Electric Orange:** `#FF6A00` - Tertiary accent (used sparingly)

## 🚀 Features

### Current Implementation (Stage 1)

✅ **Homepage with Premium Design**
- Hero section with MIVO branding
- Scroll-driven cinematic storytelling animation
- Services showcase
- Featured products section
- How it works section
- Custom project CTA
- Brand closing section

✅ **Product Marketplace**
- Browse products with search and filtering
- Category navigation
- Product cards with pricing and stock status
- Responsive grid layout

✅ **Core UI Components**
- Navigation with mobile menu
- Footer with social links
- Button component (multiple variants)
- Card components
- Input components

✅ **Data Layer**
- TypeScript type definitions
- Product management system
- Category system
- Sample product data

✅ **Logo Assets**
- Transparent background logos processed and optimized
- Multiple logo variants (horizontal and square)
- Properly integrated throughout the site

### Upcoming Features

🔄 **Product Pages**
- Individual product detail pages
- 3D model previews
- Specifications display
- Add to cart functionality

🔄 **Shopping Cart & Checkout**
- Cart management
- Checkout flow
- Order confirmation

🔄 **Custom Quote System**
- Custom project request form
- File upload for CAD files and references
- Quote management

🔄 **Admin Dashboard**
- Product management
- Order management
- Custom quote review
- File management

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Images:** Next.js Image Optimization with Sharp
- **Package Manager:** npm

## 📁 Project Structure

```
MIVO website/
├── app/                      # Next.js app directory
│   ├── layout.tsx           # Root layout with Navigation & Footer
│   ├── page.tsx             # Homepage
│   ├── explore/             # Product marketplace
│   ├── custom/              # Custom quote requests
│   ├── about/               # About page
│   ├── contact/             # Contact page
│   ├── cart/                # Shopping cart
│   └── product/[id]/        # Dynamic product pages
├── components/              # React components
│   ├── ui/                  # UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Input.tsx
│   ├── Navigation.tsx       # Header navigation
│   └── Footer.tsx           # Site footer
├── lib/                     # Utilities and data
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── data/                # Data layer
│       └── products.ts      # Product data
├── public/                  # Static assets
│   ├── mivo-logo-horizontal-transparent.png
│   └── mivo-logo-square-transparent.png
├── scripts/                 # Utility scripts
│   └── remove_logo_background.py
└── Configuration files
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── postcss.config.mjs
    └── globals.css
```

## 🎯 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3 (for logo processing scripts)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The site will be available at `http://localhost:3000`

### Build for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

## 🎨 Design System

### Typography

- Using Inter font family (sans-serif)
- Scale: Base 16px with responsive sizes
- Premium spacing and generous whitespace

### Animations

- Scroll-driven storytelling on homepage
- Hover interactions on products and CTAs
- Smooth transitions using Framer Motion
- Reduced motion support for accessibility

### Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Fully responsive navigation and layouts

## 📦 Product Categories

Current categories supported:

- **Robotics** - Motor mounts, servo brackets, sensor holders
- **Electronics** - Arduino cases, Raspberry Pi enclosures
- **Organization** - Cable management, desk organizers
- **Prototyping** - Custom prototype parts and fixtures

## 🎬 Homepage Storytelling

The cinematic scroll animation tells the MIVO story in 4 stages:

1. **Imagine** - Engineering sketch appears
2. **Design** - Sketch transforms into CAD wireframe
3. **Manufacture** - Layers build up (3D printing visualization)
4. **Made Real** - MIVO brand reveal with tagline

## 🔐 Security & Best Practices

- TypeScript for type safety
- Server-side validation ready
- Secure file handling infrastructure
- No exposed API keys in frontend
- Image optimization with Next.js
- Performance-first implementation

## 📱 Contact Integration

- WhatsApp business integration ready
- Email contact forms
- Social media links (Instagram, Email)
- Location: Vijayawada, Andhra Pradesh

## 🎨 Logo Files

The project includes professionally processed logo files:

- `mivo-logo-horizontal-transparent.png` - Main horizontal logo with transparent background
- `mivo-logo-square-transparent.png` - Square variant for compact spaces

Original logos with backgrounds are preserved in the root directory.

## 🚧 Development Roadmap

### Phase 2: Product & Cart System
- Individual product pages
- Shopping cart functionality
- Checkout flow
- Order management

### Phase 3: Custom Orders
- Custom quote request form
- File upload system
- Admin quote review

### Phase 4: Admin Dashboard
- Product CRUD operations
- Order management
- Analytics and insights

### Phase 5: Backend Integration
- Database integration (Supabase recommended)
- Authentication system
- File storage
- Payment gateway integration

## 📄 License

Private project for MIVO business.

## 🙋 Support

For questions or support, contact the MIVO team.

---

**MIVO** - Making Ideas into Visible Objects
