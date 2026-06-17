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
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
    bestRating: "5",
    worstRating: "1",
  },
  author: {
    "@type": "Organization",
    name: "Nabeeh",
    url: baseUrl,
  },
};

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Nabeeh?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nabeeh is a smart teaching assistant designed for private tutors and tutoring centers. It helps you manage attendance, grades, student information, and parent communication — all in one place.",
      },
    },
    {
      "@type": "Question",
      name: "How does the WhatsApp integration work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Parents can send messages to your Nabeeh WhatsApp number asking about their child's attendance, grades, or schedule. The bot automatically responds with the relevant information from your database.",
      },
    },
    {
      "@type": "Question",
      name: "Is Nabeeh really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! The free tier includes everything an individual tutor needs to get started — up to 20 students, attendance tracking, grade management, and the WhatsApp bot. Premium tiers are coming soon.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to set up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can get started in minutes. Simply create an account, add your students and groups, and you're ready to go. No technical knowledge required.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data secure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Nabeeh uses enterprise-grade security with encrypted data storage. Your students' information is protected and never shared with third parties.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer support in Arabic?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Nabeeh is fully bilingual (Arabic and English). You can switch between languages at any time, and our support team communicates in both languages.",
      },
    },
  ],
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

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Set Up Nabeeh Teaching Assistant",
  description:
    "Steps to set up Nabeeh for managing students, attendance, and parent communication.",
  dateModified: new Date().toISOString().split('T')[0],
  step: [
    {
      "@type": "HowToStep",
      name: "Create Account",
      text: "Sign up for a free Nabeeh account at nabeeh.app. No credit card required.",
      url: `${baseUrl}/en/register`,
    },
    {
      "@type": "HowToStep",
      name: "Add Students",
      text: "Add your students with their names, phone numbers, and parent WhatsApp contacts.",
      url: `${baseUrl}/en/dashboard/students`,
    },
    {
      "@type": "HowToStep",
      name: "Create Groups",
      text: "Organize students into groups with schedules and capacity limits.",
      url: `${baseUrl}/en/dashboard/courses`,
    },
    {
      "@type": "HowToStep",
      name: "Start Tracking",
      text: "Begin recording attendance, creating assessments, and managing grades.",
      url: `${baseUrl}/en/dashboard/attendance`,
    },
  ],
  totalTime: "PT5M",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
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
