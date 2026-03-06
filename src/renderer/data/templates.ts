/**
 * Templates Data
 *
 * Pre-defined project templates for the showcase screen.
 * Each template has a starter prompt that pre-fills the chat.
 */

export interface Template {
  id: string;
  title: string;
  description: string;
  category: 'website' | 'document' | 'design';
  estimatedTime: string;
  starterPrompt: string;
  thumbnail: TemplateThumbnail;
}

export interface TemplateThumbnail {
  icon: string;
  gradient: string;
}

export const templates: Template[] = [
  {
    id: 'ecommerce-store',
    title: 'E-commerce Store',
    description: 'A modern online store with product listings, cart, and checkout flow',
    category: 'website',
    estimatedTime: '15-20 min',
    starterPrompt:
      'Build me a modern e-commerce store with a clean product grid, shopping cart functionality, and a simple checkout flow. Use a minimalist design with good typography.',
    thumbnail: {
      icon: 'cart',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
  },
  {
    id: 'portfolio-website',
    title: 'Portfolio Website',
    description: 'A personal portfolio to showcase your work and skills',
    category: 'website',
    estimatedTime: '10-15 min',
    starterPrompt:
      'Create a personal portfolio website with sections for About Me, Projects, Skills, and Contact. Make it professional but with personality. Include smooth scroll and subtle animations.',
    thumbnail: {
      icon: 'user',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
  },
  {
    id: 'restaurant-site',
    title: 'Restaurant Site',
    description: 'An elegant restaurant website with menu and reservations',
    category: 'website',
    estimatedTime: '12-18 min',
    starterPrompt:
      'Build an elegant restaurant website with a hero image, menu section with categories, online reservation form, location map, and hours. Use warm colors and elegant typography.',
    thumbnail: {
      icon: 'utensils',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
  },
  {
    id: 'landing-page',
    title: 'Landing Page',
    description: 'A high-converting landing page for your product or service',
    category: 'website',
    estimatedTime: '8-12 min',
    starterPrompt:
      'Create a high-converting landing page with a compelling hero section, features grid, testimonials, pricing table, and a strong call-to-action. Focus on conversion optimization.',
    thumbnail: {
      icon: 'rocket',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  },
  {
    id: 'market-research',
    title: 'Market Research Report',
    description: 'A comprehensive market analysis document with insights',
    category: 'document',
    estimatedTime: '20-30 min',
    starterPrompt:
      'Create a comprehensive market research report template that includes executive summary, market overview, competitive analysis, target audience personas, SWOT analysis, and recommendations.',
    thumbnail: {
      icon: 'chart',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
  },
  {
    id: 'brand-identity',
    title: 'Brand Identity',
    description: 'A complete brand kit with logo concepts and guidelines',
    category: 'design',
    estimatedTime: '25-35 min',
    starterPrompt:
      'Design a complete brand identity system including logo concepts, color palette, typography recommendations, and basic brand guidelines. Include examples of how the brand would look on business cards and social media.',
    thumbnail: {
      icon: 'palette',
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    },
  },
];

export const getCategoryLabel = (category: Template['category']): string => {
  const labels: Record<Template['category'], string> = {
    website: 'Website',
    document: 'Document',
    design: 'Design',
  };
  return labels[category];
};

export const getCategoryColor = (category: Template['category']): string => {
  const colors: Record<Template['category'], string> = {
    website: '#1b70db',
    document: '#10a37f',
    design: '#cc785c',
  };
  return colors[category];
};
