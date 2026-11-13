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
    issue: z.string().optional(),                 // المجلد والعدد
    year: z.number().optional(),
    summary: z.string(),
    pdf: z.string().optional(),                   // مثل: /files/social-determinants.pdf
    pages: z.number().optional(),
    cover: z.string().optional(),
    order: z.number().default(0),                 // للترتيب: الأكبر أولًا
  }),
});

export const collections = { posts, studies };
