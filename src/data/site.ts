// بيانات الموقع العامة — عدّلها من هنا
export const site = {
  title: "أحمد عباس الملجمي",
  tagline: "باحث في علم الاجتماع والأنثروبولوجيا",
  description:
    "الموقع الرسمي للباحث اليمني أحمد عباس الملجمي: مقالات ودراسات في المجتمع اليمني وذهنيته وتحولاته.",
  url: "https://almaljamie.my",
  // الحقول الفارغة لا تظهر في الموقع
  email: "",
  phone: "",
  whatsapp: "",   // رقم بصيغة دولية دون + مثل 60123456789
  facebook: "https://www.facebook.com/Almaljamie/",
  x: "https://x.com/ALMALJAMIE",
  telegram: "",
  instagram: "https://www.instagram.com/a.abbbas.m/",
  youtube: "",
  googleScholar: "",
  researchgate: "",
};

export const nav = [
  { href: "/", label: "الرئيسية" },
  { href: "/cv/", label: "السيرة الذاتية" },
  { href: "/articles/", label: "المقالات" },
  { href: "/studies/", label: "الدراسات المنشورة" },
];
export const notebook = { href: "/notebook/", label: "مفكرة الباحث الذكية" };

export const socials = [
  { key: "facebook", label: "فيسبوك", d: "M14 8h2.5V4.5H14c-2.2 0-4 1.8-4 4V10H8v3.5h2V21h3.5v-7.5H16l.5-3.5h-3V8.5c0-.3.2-.5.5-.5z" },
  { key: "x", label: "إكس", d: "M4 4h4.5l3.7 5.2L16.6 4H20l-6.2 7.1L20.5 20H16l-4-5.6L7.1 20H3.7l6.7-7.7z" },
  { key: "telegram", label: "تيليجرام", d: "M20.7 4.3 3.4 11c-1 .4-1 1.1-.2 1.4l4.4 1.4 1.7 5.2c.2.6.4.8.8.8s.6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8L21.9 5.6c.3-1.2-.4-1.7-1.2-1.3zM9 14.3l9-6.6-7.2 7.6-.3 3.2z" },
  { key: "instagram", label: "إنستغرام", d: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM17 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" },
  { key: "youtube", label: "يوتيوب", d: "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" },
] as const;

export const activeSocials = () =>
  socials.filter((s) => (site as Record<string, string>)[s.key]).map((s) => ({ ...s, href: (site as Record<string, string>)[s.key] }));
