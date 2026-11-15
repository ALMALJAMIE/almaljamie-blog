import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const slugFromFile = ({ entry }: { entry: string }) =>
  entry.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");

// المقالات: src/content/posts/2026-12-01-qabali.md ← /articles/qabali/
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts", generateId: slugFromFile }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string().default("مقالات"),
    summary: z.string().optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),   // كلمات مفتاحية
    series: z.string().optional(),            // اسم السلسلة: مقالاتها تُرتب حسب التاريخ وتُربط ببعضها
    draft: z.boolean().default(false),
  }),
});

// الدراسات المنشورة: src/content/studies/social-determinants.md
// ملف PDF يوضع في public/files/ ويُكتب اسمه في الحقل pdf
const studies = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/studies", generateId: slugFromFile }),
  schema: z.object({
    title: z.string(),
    type: z.string().default("دراسة محكّمة"),     // دراسة محكّمة / رسالة ماجستير / ورقة بحثية...
    status: z.enum(["published", "in-progress"]).default("published"),
    journal: z.string().optional(),               // اسم المجلة أو الجامعة
    publisher: z.string().optional(),             // الناشر إن اختلف عن المجلة
    issn: z.string().optional(),
    issue: z.string().optional(),                 // المجلد والعدد
    year: z.number().optional(),
    summary: z.string(),
    pdf: z.string().optional(),                   // مثل: /files/social-determinants.pdf
    pages: z.number().optional(),
    cover: z.string().optional(),
    order: z.number().default(0),                 // للترتيب: الأكبر أولًا
    lang: z.enum(["ar", "en"]).default("ar"),     // لغة الدراسة
    authors: z.array(z.string()).default([]),    // المؤلفون إن كانت الدراسة مشتركة
    doi: z.string().optional(),                   // مثل: 10.33774/coe-2025-xxxx
    url: z.string().optional(),                   // رابط الدراسة لدى الناشر
    keywords: z.array(z.string()).default([]),    // الكلمات المفتاحية للدراسة
  }),
});

// أرشيف الإنفوجرافيك والوثائق: الملفات في public/infographics/ وملف وصف في src/content/infographics/
// نص الملف بعد علامتي --- هو الملخص الذي يظهر في صفحة العنصر
const infographics = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/infographics", generateId: slugFromFile }),
  schema: z.object({
    title: z.string(),
    kind: z.string().default("إنفوجرافيك"),   // إنفوجرافيك / وثيقة
    docType: z.string().optional(),            // وصف النوع، مثل: وثيقة حوثية سرية مسحية
    preparer: z.string().optional(),           // جهة الإعداد
    place: z.string().optional(),
    publisher: z.string().optional(),
    presenter: z.string().optional(),         // النشر والتقديم
    year: z.number().optional(),
    date: z.coerce.date().optional(),          // تاريخ الإضافة إلى الأرشيف، للترتيب
    image: z.string().optional(),              // صورة الغلاف أو صورة الإنفوجرافيك
    pdf: z.string().optional(),                // ملف للتنزيل
    pages: z.number().optional(),
    summary: z.string().optional(),            // سطران يظهران في البطاقة
    article: z.string().optional(),            // معرّف مقال مرتبط
    order: z.number().default(0),
  }),
});

export const collections = { posts, studies, infographics };
