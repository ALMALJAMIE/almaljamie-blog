import rss from "@astrojs/rss";
import { getPosts } from "../data/utils";
import { site } from "../data/site";

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    customData: "<language>ar</language>",
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary ?? "",
      link: `/articles/${p.id}/`,
      categories: [p.data.category],
    })),
  });
}
