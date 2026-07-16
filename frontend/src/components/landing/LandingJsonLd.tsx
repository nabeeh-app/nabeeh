const baseUrl = "https://nabeeh.app";

const organizationData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nabeeh",
  url: baseUrl,
  logo: `${baseUrl}/logo.png`,
  description:
    "Bilingual (AR/EN) smart teaching assistant for classroom management, student tracking, attendance, grade management, and parent communication via WhatsApp.",
  foundingDate: "2024",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["Arabic", "English"],
  },
};

const productData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Nabeeh",
  applicationCategory: "EducationApplication",
  operatingSystem: "Web",
  description:
    "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, grade management, and automated parent communication.",
  url: baseUrl,
  screenshot: `${baseUrl}/screenshot.png`,
  featureList:
    "Student management, Attendance tracking, Grade management, WhatsApp bot, Parent communication, Bilingual support, Group scheduling, Assessment creation, Reports and analytics",
  offers: {
    "@type": "AggregateOffer",
    price: "0",
    priceCurrency: "EGP",
    offerCount: "3",
    lowPrice: "0",
    highPrice: "99",
  },

  author: {
    "@type": "Organization",
    name: "Nabeeh",
    url: baseUrl,
  },
};

const websiteData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Nabeeh",
  url: baseUrl,
};

const speakableSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Nabeeh - Smart Teaching Assistant",
  dateModified: new Date().toISOString().split('T')[0],
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: [".hero-title", ".hero-subtitle", ".faq-question"],
  },
};

const pricingData = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Nabeeh Pricing Plans",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Offer",
        name: "Basic (Free)",
        price: "0",
        priceCurrency: "EGP",
        description: "Up to 20 students, 1 group, attendance tracking, basic grade management, WhatsApp bot.",
        url: `${baseUrl}/en/register`,
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Offer",
        name: "Pro",
        price: "99",
        priceCurrency: "EGP",
        description: "Unlimited students, unlimited groups, advanced reports, parent communication, priority support.",
        url: `${baseUrl}/en/register`,
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Offer",
        name: "Center",
        price: "Coming Soon",
        priceCurrency: "EGP",
        description: "Multi-teacher support, institution branding, custom WhatsApp bot, dedicated support.",
        url: `${baseUrl}/en/register`,
      },
    },
  ],
};

const breadcrumbData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: baseUrl,
    },
  ],
};

export function LandingJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  );
}
