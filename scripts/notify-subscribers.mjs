// يرسل بريدًا لمشتركي النشرة (Buttondown) عن كل مقال أو دراسة جديدة أُضيفت في هذا التحديث
// يُشغَّل من .github/workflows/notify.yml بعد نشر الموقع. المفتاح في أسرار GitHub باسم BUTTONDOWN_API_KEY
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const SITE = "https://almaljamie.my";
const KEY = process.env.BUTTONDOWN_API_KEY;
const BEFORE = process.env.BEFORE;
const AFTER = process.env.AFTER;
const DRY = process.env.DRY_RUN === "1";

if (!KEY && !DRY) { console.log("لا يوجد مفتاح BUTTONDOWN_API_KEY؛ لن يُرسل شيء."); process.exit(0); }
if (!BEFORE || /^0+$/.test(BEFORE)) { console.log("لا يوجد تحديث سابق للمقارنة."); process.exit(0); }

const added = execSync(`git diff --diff-filter=A --name-only ${BEFORE} ${AFTER} -- src/content/posts src/content/studies`)
  .toString().split("\n").filter((f) => f.endsWith(".md") && existsSync(f));
if (!added.length) { console.log("لا مقالات أو دراسات جديدة."); process.exit(0); }

const field = (fm, k) => {
  const m = fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"));
  if (!m) return undefined;
  let v = m[1].trim();
  if (/^".*"$/.test(v)) v = JSON.parse(v); else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
  return v;
};
const esc = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ننتظر حتى تصبح الصفحة الجديدة متاحة على الموقع
async function waitLive(url) {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(url, { method: "HEAD" }); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 15000));
  }
  return false;
}

for (const file of added) {
  const src = readFileSync(file, "utf8");
  const fm = (src.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  if (field(fm, "draft") === "true") continue;
  const isStudy = file.includes("/studies/");
  if (isStudy && field(fm, "status") === "in-progress") continue;
  const slug = file.split("/").pop().replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const url = `${SITE}/${isStudy ? "studies" : "articles"}/${slug}/`;
  const title = field(fm, "title");
  const summary = field(fm, "summary") || "";
  const cover = field(fm, "cover");
  const kind = isStudy ? "دراسة جديدة" : "مقال جديد";
  const button = isStudy ? "اقرأ الملخص ونزّل الدراسة" : "اقرأ المقال كاملًا";

<div dir="rtl" style="text-align:right;font-size:17px;line-height:1.9">
<p style="color:#c8962e;margin:0">${kind}</p>
<h2 style="margin:6px 0 14px">${esc(title)}</h2>
${cover ? `<p><a href="${url}"><img src="${SITE}${cover}" alt="" style="max-width:100%;border-radius:8px"></a></p>` : ""}
<p>${esc(summary)}</p>
<p><a href="${url}" style="display:inline-block;background:#13294b;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none">${button}</a></p>
</div>`;

  console.log(`${kind}: ${title} ← ${url}`);
  if (DRY) { console.log(body); continue; }
  if (!(await waitLive(url))) { console.log("الصفحة لم تظهر على الموقع بعد؛ لم يُرسل."); process.exitCode = 1; continue; }

  const r = await fetch("https://api.buttondown.com/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Token ${KEY}`,
      "Content-Type": "application/json",
      "X-API-Version": "2026-04-01",
      "X-Buttondown-Live-Dangerously": "true",
    },
    body: JSON.stringify({ subject: title, body, status: "about_to_send", canonical_url: url }),
  });
  console.log(r.status, (await r.text()).slice(0, 300));
  if (!r.ok) process.exitCode = 1;
}
