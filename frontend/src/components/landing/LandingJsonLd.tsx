const baseUrl = "https://nabeeh.app";

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
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/en/dashboard/students?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export function LandingJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
      />
    </>
  );
}
