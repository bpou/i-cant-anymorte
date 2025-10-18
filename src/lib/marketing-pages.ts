export type MarketingPageSlug =
  | "features"
  | "pricing"
  | "changelog"
  | "status"
  | "about"
  | "careers"
  | "contact"
  | "press"
  | "docs"
  | "blog"
  | "guides"
  | "support"
  | "accessibility";

type Section = {
  heading: string;
  body: string;
  items?: string[];
};

type Action = {
  href: string;
  label: string;
  external?: boolean;
};

export type MarketingPageContent = {
  kicker?: string;
  title: string;
  description: string;
  sections?: Section[];
  actions?: Action[];
};

export const MARKETING_PAGE_CONTENT: Record<MarketingPageSlug, MarketingPageContent> = {
  features: {
    kicker: "Produkt",
    title: "Funktioner",
    description: "Upptack hur Ordina samlar planering, kommunikation och leverans i samma verktyg.",
    sections: [
      {
        heading: "Planera smartare",
        body: "Se kapacitet per spar och boka jobb utan kalkylblad.",
        items: [
          "Drag och slap i tavlorna",
          "Automatiska statusregler",
          "Snabba filter for leveranser",
        ],
      },
      {
        heading: "Jobba tillsammans",
        body: "Alla filer, kommentarer och notifieringar hamnar i samma tidslinje.",
        items: [
          "Fildelning per spar",
          "Kommentarer med omtalandetaggar",
          "Pushnotiser via Pusher",
        ],
      },
    ],
    actions: [
      { href: "/orders/overview", label: "Visa orderoversikten" },
      { href: "/orders/new", label: "Skapa ny order" },
    ],
  },
  pricing: {
    kicker: "Priser",
    title: "Plan for hela teamet",
    description: "Ordina vaxer med ditt lag. Valj ett paket som passar antal spar och integrationer.",
    sections: [
      {
        heading: "Bas",
        body: "Perfekt nar ni vill komma igang med struktur utan att krangla till det.",
        items: ["Obegransade ordrar", "Tva spar ingar", "E-postsupport inom 24 timmar"],
      },
      {
        heading: "Pro",
        body: "For verksamheter som behover fler spar, integrationer och prioriterad support.",
        items: [
          "Upp till sex spar",
          "Fortnox och Minio-integration",
          "Onboarding med kontaktperson",
        ],
      },
    ],
    actions: [
      { href: "mailto:info@ordina.se", label: "Be om offert", external: true },
      { href: "/orders/new", label: "Prova dagens licens" },
    ],
  },
  changelog: {
    kicker: "Produkt",
    title: "Nyheter i Ordina",
    description: "Folj vad som ar nytt, fixat och pa vag i plattformen.",
    sections: [
      {
        heading: "Senaste releaser",
        body: "De har nyheterna ar redan ute hos er.",
        items: [
          "Forbattrade statuskort i oversikten",
          "Snabbare filuppladdning",
          "Storre Fortnox-sync med offerter",
        ],
      },
      {
        heading: "Pa plan",
        body: "Vi prioriterar tillsammans med kunder. Har ar nasta steg.",
        items: [
          "Kalender med drag mellan spar",
          "Automatiska avvikelser",
          "Mobil instruktion for montage",
        ],
      },
    ],
    actions: [{ href: "mailto:roadmap@ordina.se", label: "Tipsa oss", external: true }],
  },
  status: {
    kicker: "Drift",
    title: "Systemstatus",
    description: "Aktuell driftsinformation for Ordina och integrationer.",
    sections: [
      {
        heading: "Tjanster vi overvaknar",
        body: "Statusen uppdateras automatiskt nar nagot avviker.",
        items: [
          "Ordina appen",
          "Fortnox integration",
          "Pusher realtidskanaler",
          "Minio filhantering",
        ],
      },
      {
        heading: "Kontakt vid avbrott",
        body: "Behov av snabb hjalp? Anvand dessa vagar.",
        items: [
          "E-post: drift@ordina.se",
          "Telefon: +46 8 123 456 70",
          "Slack-kanal for kunder",
        ],
      },
    ],
    actions: [{ href: "/support", label: "Oppna supportguiden" }],
  },
  about: {
    kicker: "Foretag",
    title: "Om Ordina",
    description: "Vi bygger ett verktyg som gor hantverksforetag mer effektiva utan extra administration.",
    sections: [
      {
        heading: "Var historia",
        body: "Ordina startade i verkstaden och vaxte fram ur ett riktigt kapacitetsproblem.",
        items: [
          "Grundat 2021 i Stockholm",
          "Team med bakgrund i produktion och tech",
          "Fokus pa integrationer som spar tid",
        ],
      },
      {
        heading: "Vara varderingar",
        body: "Transparens, samarbete och tempo driver produkten fram.",
        items: ["Nara kunddialog", "Snabb iteration", "Hallbar vardag for teamen"],
      },
    ],
    actions: [{ href: "/press", label: "Lasa pressrummet" }],
  },
  careers: {
    kicker: "Foretag",
    title: "Karriar pa Ordina",
    description: "Vill du bygga framtidens orderflode? Vi soker nyfikna personer som gillar tempo.",
    sections: [
      {
        heading: "Var kultur",
        body: "Hos oss far du ansvar tidigt och jobbar tajt med kunderna.",
        items: [
          "Hybridarbete i Stockholm",
          "Hackveckor varje kvartal",
          "Generost kunskapsutbyte",
        ],
      },
      {
        heading: "Oopna roller",
        body: "Vi letar efter personer inom produkt, teknik och kundteam.",
        items: [
          "Fullstackutvecklare",
          "Produktdesigner",
          "Implementation specialist",
        ],
      },
    ],
    actions: [{ href: "mailto:careers@ordina.se", label: "Skicka spontanansokan", external: true }],
  },
  contact: {
    kicker: "Foretag",
    title: "Kontakt",
    description: "Hor av dig for demo, support eller partnerskap.",
    sections: [
      {
        heading: "Support",
        body: "Vi svarar snabbast via e-post.",
        items: [
          "E-post: support@ordina.se",
          "Telefon: +46 8 123 456 70",
          "Kundportal: logga in och skapa arende",
        ],
      },
      {
        heading: "Besok oss",
        body: "Ordina AB, Hornsgatan 10, 118 20 Stockholm. Boka tid innan du kommer.",
      },
    ],
    actions: [
      { href: "mailto:info@ordina.se", label: "Skicka e-post", external: true },
      { href: "/support", label: "Ga till supportguiden" },
    ],
  },
  press: {
    kicker: "Foretag",
    title: "Pressrum",
    description: "Resurser, logotyper och nyheter for partner och media.",
    sections: [
      {
        heading: "Presskontakt",
        body: "Kontakta vart press-team for citat eller intervju.",
        items: [
          "E-post: press@ordina.se",
          "Telefon: +46 70 321 45 67",
          "Presskit med logotyper och riktlinjer",
        ],
      },
      {
        heading: "Senaste nyheter",
        body: "Vi delar kundcase, partnerskap och produktuppdateringar.",
        items: [
          "Ny kalendervy for spar A-D",
          "Partnerskap med Fortnox",
          "Kundcase: SignLab sparar tid",
        ],
      },
    ],
    actions: [{ href: "/blog", label: "Lasa fler artiklar" }],
  },
  docs: {
    kicker: "Resurser",
    title: "Dokumentation",
    description: "Teknisk och funktionell dokumentation for administratorer och integrationsteam.",
    sections: [
      {
        heading: "Kom igang",
        body: "Borsja har nar du ska konfigurera en ny miljo.",
        items: [
          "Installationsguide",
          "Roller och behorigheter",
          "Notifieringsinstallningar",
        ],
      },
      {
        heading: "Teknik",
        body: "Allt om API, webhookar och filsynk.",
        items: [
          "API-referens",
          "Webhook-exempel",
          "Guide for Minio och S3",
        ],
      },
    ],
    actions: [{ href: "mailto:support@ordina.se", label: "Be om admintraning", external: true }],
  },
  blog: {
    kicker: "Resurser",
    title: "Blogg",
    description: "Inspiration, guider och kundberattelser.",
    sections: [
      {
        heading: "Tema",
        body: "Vi skriver om effektiv vardag for hantverksteam.",
        items: [
          "Planering och kapacitet",
          "Digitalt samarbete",
          "Ekonomi och uppfoljning",
        ],
      },
      {
        heading: "Bidra",
        body: "Vill du dela din resa? Vi publicerar garna gaster.",
        items: [
          "Maila content@ordina.se",
          "Vi gor intervjuer digitalt eller pa plats",
          "Vi fotar och redigerar materialet",
        ],
      },
    ],
    actions: [{ href: "mailto:content@ordina.se", label: "Tipsa om ett amne", external: true }],
  },
  guides: {
    kicker: "Resurser",
    title: "Guider",
    description: "Steg for steg-guider som hjalper dina team.",
    sections: [
      {
        heading: "Favoriter",
        body: "Starta har for att fa ut mest redan forsta veckan.",
        items: [
          "Sa satter du upp spar",
          "Mall for aterkommande order",
          "Checklista for avslut",
        ],
      },
      {
        heading: "Video och mallar",
        body: "Ladda ner mallar eller se inspelade genomgangar.",
        items: [
          "Tio minuter introduktion",
          "Mall for veckoplanering",
          "Checklista for montage",
        ],
      },
    ],
    actions: [{ href: "/support", label: "Kontakta supporten" }],
  },
  support: {
    kicker: "Support",
    title: "Support och hjalp",
    description: "Sjalvhjalp, kontaktvagar och statusinformation pa ett stalle.",
    sections: [
      {
        heading: "Sjalvhjalp",
        body: "Borsja har nar du vill losa nagot direkt.",
        items: [
          "Felsokning: varfor syns inte ordern?",
          "Kom igang med Fortnox",
          "Lagg till nya anvandare",
        ],
      },
      {
        heading: "Kontakta oss",
        body: "Vi svarar snabbast via e-post, ring om det ar akutt.",
        items: [
          "E-post: support@ordina.se",
          "Telefon: +46 8 123 456 70",
          "Jour: drift@ordina.se",
        ],
      },
    ],
    actions: [
      { href: "mailto:support@ordina.se", label: "Skicka supportarende", external: true },
      { href: "/status", label: "Kontrollera drift" },
    ],
  },
  accessibility: {
    kicker: "Juridik",
    title: "Tillganglighet",
    description: "Vi vill att alla ska kunna anvanda Ordina. Har beskriver vi vad som fungerar och vad vi jobbar pa.",
    sections: [
      {
        heading: "Vart arbete",
        body: "Ordina foljer WCAG 2.1 AA sa langt det ar mojligt.",
        items: [
          "Kontrasttestade komponenter",
          "Tangentbordsstod i menyer",
          "Beskrivande etiketter och aria-attribut",
        ],
      },
      {
        heading: "Rapportera hinder",
        body: "Hittar du nagot som kan bli battre? Skriv till oss.",
        items: [
          "E-post: accessibility@ordina.se",
          "Feedbackknappen i appen",
          "Aterkoppling inom fem arbetsdagar",
        ],
      },
    ],
    actions: [{ href: "mailto:accessibility@ordina.se", label: "Lama in synpunkter", external: true }],
  },
};

export function getMarketingPageContent(slug: string): MarketingPageContent | null {
  const normalized = slug.toLowerCase() as MarketingPageSlug;
  return MARKETING_PAGE_CONTENT[normalized] ?? null;
}

export type FooterLink = {
  href: string;
  label: string;
};

export type FooterGroup = {
  heading: string;
  links: FooterLink[];
};

export const FOOTER_LINK_GROUPS: FooterGroup[] = [
  {
    heading: "Produkt",
    links: [
      { href: "/features", label: "Funktioner" },
      { href: "/pricing", label: "Priser" },
      { href: "/changelog", label: "Changelog" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    heading: "Foretag",
    links: [
      { href: "/about", label: "Om oss" },
      { href: "/careers", label: "Karriar" },
      { href: "/contact", label: "Kontakt" },
      { href: "/press", label: "Press" },
    ],
  },
  {
    heading: "Resurser",
    links: [
      { href: "/docs", label: "Dokumentation" },
      { href: "/blog", label: "Blogg" },
      { href: "/guides", label: "Guider" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    heading: "Juridik",
    links: [
      { href: "/integritet", label: "Integritet" },
      { href: "/villkor", label: "Villkor" },
      { href: "/cookies", label: "Cookies" },
      { href: "/sakerhet", label: "Sakerhet" },
    ],
  },
];
