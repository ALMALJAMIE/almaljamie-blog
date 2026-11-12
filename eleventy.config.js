// إعدادات بناء المدونة — Eleventy
export default function (eleventyConfig) {
  // ملفات تُنسخ كما هي إلى الموقع النهائي
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // مجموعة المقالات: كل ملف داخل src/posts، مرتبة من الأحدث إلى الأقدم
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date)
  );

  // قائمة التصنيفات المستعملة في المقالات
  eleventyConfig.addCollection("categories", (api) => {
    const set = new Set();
    api.getFilteredByGlob("src/posts/*.md").forEach((p) => {
      if (p.data.category) set.add(p.data.category);
    });
    return [...set];
  });

  // تاريخ بالعربية بأرقام عربية (1، 2، 3)
  eleventyConfig.addFilter("arDate", (d) =>
    new Date(d).toLocaleDateString("ar-u-nu-latn", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));
  eleventyConfig.addFilter("byCategory", (arr, c) =>
    arr.filter((p) => p.data.category === c)
  );

  // مدة القراءة التقريبية (200 كلمة في الدقيقة)
  eleventyConfig.addFilter("readingTime", (content) => {
    const words = String(content || "")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    const m = Math.max(1, Math.round(words / 200));
    if (m === 1) return "دقيقة قراءة";
    if (m === 2) return "دقيقتا قراءة";
    if (m <= 10) return `${m} دقائق قراءة`;
    return `${m} دقيقة قراءة`;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
