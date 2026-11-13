import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection("posts", (p) => !p.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const arDate = (d: Date) =>
  d.toLocaleDateString("ar-u-nu-latn", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function readingTime(body = ""): string {
  const words = body.replace(/[#>*_`\-\[\]()!]/g, " ").split(/\s+/).filter(Boolean).length;
  const m = Math.max(1, Math.round(words / 200));
  if (m === 1) return "دقيقة قراءة";
  if (m === 2) return "دقيقتا قراءة";
  if (m <= 10) return `${m} دقائق قراءة`;
  return `${m} دقيقة قراءة`;
}

// رقم ثابت مشتق من نص — لتوليد غلاف مختلف لكل مقال
export function seed(str: string): number {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

export async function getStudies() {
  const all = await getCollection("studies");
  return all.sort((a, b) => b.data.order - a.data.order || (b.data.year ?? 0) - (a.data.year ?? 0));
}

// عدّ بالعربية: arCount(n, "مقال واحد", "مقالان", "مقالات", "مقالًا")
export function arCount(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
