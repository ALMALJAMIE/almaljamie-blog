// مفكرة الباحث الذكية — كل البيانات في متصفح المستخدم (IndexedDB)
// المخازن: projects، items، files (الصور وملفات PDF)

type Kind = "quote" | "note" | "image" | "pdf" | "ref";
interface Project { id: string; name: string; created: number }
interface Item {
  id: string; type: Kind; project: string;
  text?: string; author?: string; source?: string; year?: string; page?: string;
  publisher?: string; url?: string; tags: string[];
  file?: string; fileName?: string; fileSize?: number;
  created: number; updated: number;
}
interface StoredFile { id: string; blob: Blob; name: string; type: string }

const KINDS: { key: Kind; label: string; badge: string }[] = [
  { key: "quote", label: "مقتبس", badge: "bg-indigo/10 text-indigo dark:bg-white/10 dark:text-[#9fb6dc]" },
  { key: "note", label: "فكرة", badge: "bg-saffron/15 text-mud dark:text-saffron" },
  { key: "image", label: "صورة", badge: "bg-glass-green/12 text-glass-green" },
  { key: "pdf", label: "PDF", badge: "bg-glass-red/10 text-glass-red" },
  { key: "ref", label: "مرجع", badge: "bg-glass-blue/10 text-glass-blue dark:text-[#8fb4e8]" },
];
const kindOf = (k: Kind) => KINDS.find((x) => x.key === k)!;
const MAX_FILE = 15 * 1024 * 1024;

// ---------- قاعدة البيانات ----------
let db: IDBDatabase;
const openDB = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open("researcher-notebook", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("projects", { keyPath: "id" });
      d.createObjectStore("items", { keyPath: "id" });
      d.createObjectStore("files", { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const tx = <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void) =>
  new Promise<T>((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res((req as IDBRequest | undefined)?.result as T);
    t.onerror = () => rej(t.error);
  });
const all = <T,>(store: string) => tx<T[]>(store, "readonly", (s) => s.getAll());
const put = (store: string, v: unknown) => tx(store, "readwrite", (s) => { s.put(v); });
const del = (store: string, id: string) => tx(store, "readwrite", (s) => { s.delete(id); });
const getFile = (id: string) => tx<StoredFile | undefined>("files", "readonly", (s) => s.get(id));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- الحالة ----------
let projects: Project[] = [];
let items: Item[] = [];
const state = { project: "all", kind: "all" as Kind | "all", q: "", tag: "" };
try { const s = JSON.parse(localStorage.getItem("nb:view") || "{}"); if (s.project) state.project = s.project; } catch {}
const saveView = () => { try { localStorage.setItem("nb:view", JSON.stringify({ project: state.project })); } catch {} };

// ---------- أدوات ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const isLatin = (s = "") => /^[\sA-Za-z0-9À-ž.,&'’\-()]+$/.test(s.trim()) && /[A-Za-z]/.test(s);
const arNum = (n: number) => n.toLocaleString("ar-u-nu-latn");
const mb = (b: number) => (b / 1048576).toLocaleString("ar-u-nu-latn", { maximumFractionDigits: 1 });
const count = (n: number, one: string, two: string, few: string, many: string) =>
  n === 0 ? `لا ${few}` : n === 1 ? one : n === 2 ? two : n % 100 >= 3 && n % 100 <= 10 ? `${arNum(n)} ${few}` : `${arNum(n)} ${many}`;
const relDate = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86400000);
  if (d < 1) return "اليوم";
  if (d === 1) return "أمس";
  if (d === 2) return "قبل يومين";
  if (d <= 10) return `قبل ${arNum(d)} أيام`;
  return new Date(t).toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "long", year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
const parseTags = (s: string) =>
  [...new Set(s.split(/[\s،,]+/).map((t) => t.replace(/^#+/, "").trim()).filter(Boolean).map((t) => "#" + t))];

// التوثيق داخل المتن: (المؤلف، السنة، ص 12) أو (Author, Year, p. 12)
function citation(it: Partial<Item>) {
  const a = (it.author || "").trim(), y = (it.year || "").trim(), p = (it.page || "").trim();
  if (!a && !y) return "";
  if (isLatin(a)) return `(${[a || "n.a.", y || "n.d.", p && `p. ${p}`].filter(Boolean).join(", ")})`;
  return `(${[a || "د.م", y || "د.ت", p && `ص ${p}`].filter(Boolean).join("، ")})`;
}
// المرجع بنمط APA: المؤلف. (السنة). العنوان. الناشر.
function apa(it: Partial<Item>, html = true) {
  const a = (it.author || "").trim(), y = (it.year || "").trim(), t = (it.source || "").trim(), pub = (it.publisher || "").trim(), url = (it.url || "").trim();
  if (!t && !a) return "";
  const lat = isLatin(a || t);
  const title = html ? `<i>${esc(t)}</i>` : t;
  const parts = [
    a ? `${html ? esc(a) : a}${/[.]$/.test(a) ? "" : "."}` : "",
    `(${y || (lat ? "n.d." : "د.ت")}).`,
    t ? `${title}.` : "",
    pub ? `${html ? esc(pub) : pub}.` : "",
    url ? (html ? `<span dir="ltr">${esc(url)}</span>` : url) : "",
  ].filter(Boolean);
  return parts.join(" ");
}
function toast(msg: string) {
  const t = $("nb-toast"); t.textContent = msg; t.classList.remove("opacity-0");
  clearTimeout((t as any)._h); (t as any)._h = setTimeout(() => t.classList.add("opacity-0"), 2200);
}
async function copy(text: string, msg = "نُسخ") {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt("انسخ النص:", text); }
}

// ---------- العرض ----------
const inScope = (it: Item) => state.project === "all" || it.project === state.project;
function filtered() {
  const q = state.q.trim().toLowerCase();
  return items
    .filter(inScope)
    .filter((it) => state.kind === "all" || it.type === state.kind)
    .filter((it) => !state.tag || it.tags.includes(state.tag))
    .filter((it) => !q || [it.text, it.author, it.source, it.publisher, it.fileName, it.tags.join(" ")].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.created - a.created);
}

function renderProjects() {
  const counts = new Map<string, number>();
  items.forEach((i) => counts.set(i.project, (counts.get(i.project) || 0) + 1));
  const li = (id: string, name: string, n: number, muted = false) => {
    const active = state.project === id;
    return `<li class="group relative">
      <button type="button" data-project="${id}" class="w-full flex justify-between gap-2 px-3 py-2 rounded-lg text-start leading-snug ${active ? "bg-indigo text-white dark:bg-saffron dark:text-ink font-medium" : muted ? "text-[var(--muted)] hover:bg-[var(--bg-2)]" : "hover:bg-[var(--bg-2)]"}">
        <span>${esc(name)}</span><span class="${active ? "opacity-80" : "text-[var(--muted)]"}">${arNum(n)}</span>
      </button>
      ${id !== "all" ? `<button type="button" data-project-menu="${id}" class="absolute top-1/2 -translate-y-1/2 end-1.5 w-7 h-7 rounded-md ${active ? "bg-indigo text-white dark:bg-saffron dark:text-ink" : "bg-[var(--bg-2)] text-[var(--fg)]"} opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="خيارات المشروع">⋯</button>` : ""}
    </li>`;
  };
  $("nb-projects").innerHTML = li("all", "كل الأرشيف", items.length, true) + projects.map((p) => li(p.id, p.name, counts.get(p.id) || 0)).join("");
  $<HTMLSelectElement>("nb-project-select").innerHTML =
    `<option value="all">كل الأرشيف (${arNum(items.length)})</option>` +
    projects.map((p) => `<option value="${p.id}">${esc(p.name)} (${arNum(counts.get(p.id) || 0)})</option>`).join("") +
    `<option value="__new">+ مشروع جديد</option>`;
  $<HTMLSelectElement>("nb-project-select").value = state.project;
}

function renderHeader() {
  const scope = items.filter(inScope);
  const p = projects.find((x) => x.id === state.project);
  $("nb-kicker").textContent = p ? "مفكرة الباحث الذكية · مشروع" : "مفكرة الباحث الذكية";
  $("nb-title").textContent = p ? p.name : "كل الأرشيف";
  const n = (k: Kind) => scope.filter((i) => i.type === k).length;
  const parts = [count(scope.length, "عنصر واحد", "عنصران", "عناصر", "عنصرًا")];
  if (n("quote")) parts.push(count(n("quote"), "مقتبس واحد", "مقتبسان", "مقتبسات", "مقتبسًا"));
  if (n("ref")) parts.push(count(n("ref"), "مرجع واحد", "مرجعان", "مراجع", "مرجعًا"));
  const last = scope.reduce((m, i) => Math.max(m, i.created), 0);
  if (last) parts.push(`آخر إضافة ${relDate(last)}`);
  $("nb-stats").textContent = parts.join(" · ");
}

function renderTypes() {
  const scope = items.filter(inScope);
  const chip = (key: string, label: string, n: number) => {
    const on = state.kind === key;
    return `<button type="button" data-kind="${key}" aria-pressed="${on}" class="shrink-0 px-3.5 py-2 rounded-full text-[0.9rem] border ${on ? "bg-[var(--fg)] text-[var(--bg)] border-transparent" : "border-[var(--rule)] text-[var(--muted)] hover:text-[var(--fg)]"}">${label} <span class="opacity-60">${arNum(n)}</span></button>`;
  };
  $("nb-types").innerHTML = chip("all", "الكل", scope.length) + KINDS.map((k) => chip(k.key, k.label, scope.filter((i) => i.type === k.key).length)).join("");
}

function renderTags() {
  const counts = new Map<string, number>();
  items.filter(inScope).forEach((i) => i.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const tags = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 30);
  $("nb-tags-wrap").hidden = !tags.length;
  $("nb-tags").innerHTML = tags.map(([t]) =>
    `<button type="button" data-tag="${esc(t)}" class="px-2.5 py-1 rounded-full text-[0.85rem] ${state.tag === t ? "bg-indigo text-white dark:bg-saffron dark:text-ink" : "bg-[var(--bg-2)] hover:text-indigo"}">${esc(t)}</button>`).join("");
  const at = $("nb-active-tag");
  at.hidden = !state.tag;
  at.innerHTML = state.tag ? `الوسم: <b>${esc(state.tag)}</b> <button type="button" data-tag="${esc(state.tag)}" class="ms-2 text-indigo dark:text-saffron">إلغاء</button>` : "";
}

const objectUrls: string[] = [];
async function renderList() {
  objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const list = filtered();
  const box = $("nb-list"), empty = $("nb-empty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    const none = items.filter(inScope).length === 0;
    empty.innerHTML = none
      ? `<div class="rounded-2xl border-2 border-dashed border-[var(--rule)] p-10 text-center max-w-2xl mx-auto">
          <h2 class="text-[1.4rem]">${items.length ? "هذا المشروع فارغ" : "مرحبًا بك في مفكرتك"}</h2>
          <p class="mt-3 text-[var(--muted)] leading-[2]">احفظ هنا ما تجمعه أثناء البحث: المقتبس مع مصدره وصفحته، والفكرة التي خطرت لك، ولقطة الشاشة من كتاب، وملف PDF، والمرجع. ورتّبها في مشاريع، وستجد التوثيق وقائمة المراجع بنمط APA جاهزين.</p>
          <button type="button" data-action="add" class="mt-6 px-6 py-3 rounded-full bg-indigo text-white font-bold dark:bg-saffron dark:text-ink">أضف أول عنصر</button>
        </div>`
      : `<p class="text-center text-[var(--muted)] py-10">لا نتائج لهذا البحث.</p>`;
    box.innerHTML = "";
    return;
  }
  box.innerHTML = list.map(card).join("");
  // تحميل الصور من قاعدة البيانات
  for (const img of box.querySelectorAll<HTMLImageElement>("img[data-file]")) {
    const f = await getFile(img.dataset.file!);
    if (f) { const u = URL.createObjectURL(f.blob); objectUrls.push(u); img.src = u; }
  }
}

function card(it: Item) {
  const k = kindOf(it.type);
  const proj = state.project === "all" ? projects.find((p) => p.id === it.project)?.name : "";
  const head = `<div class="flex items-center justify-between gap-2">
      <span class="px-2.5 py-0.5 rounded-full text-[0.78rem] font-medium ${k.badge}">${k.label}</span>
      <span class="text-[0.8rem] text-[var(--muted)] truncate">${proj ? esc(proj) + " · " : ""}${relDate(it.created)}</span>
    </div>`;
  const tags = it.tags.length ? `<p class="mt-3 text-[0.85rem] flex flex-wrap gap-x-2">${it.tags.map((t) => `<button type="button" data-tag="${esc(t)}" class="text-glass-blue dark:text-[#8fb4e8] hover:underline">${esc(t)}</button>`).join("")}</p>` : "";
  const actions = `<div class="mt-4 pt-3 border-t border-[var(--rule)] flex gap-4 text-[0.85rem] text-[var(--muted)]">
      <button type="button" data-edit="${it.id}" class="hover:text-[var(--fg)]">تعديل</button>
      <button type="button" data-copy-text="${it.id}" class="hover:text-[var(--fg)]">نسخ النص</button>
      <button type="button" data-delete="${it.id}" class="ms-auto hover:text-glass-red">حذف</button>
    </div>`;
  const srcLine = [it.author, it.source, it.page && `ص ${it.page}`].filter(Boolean).map((x) => esc(x!)).join(" · ");
  const cite = citation(it);
  const citeBox = cite ? `<div class="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-2)] px-3 py-2 text-[0.88rem]">
      <span ${isLatin(it.author) ? 'dir="ltr"' : ""}>${esc(cite)}</span>
      <button type="button" data-copy-cite="${it.id}" class="shrink-0 text-indigo dark:text-saffron font-medium">نسخ التوثيق</button></div>` : "";

  switch (it.type) {
    case "quote":
      return `<article class="rounded-2xl border border-[var(--rule)] bg-[var(--bg)] p-5">${head}
        <blockquote dir="auto" class="mt-4 font-read text-[1.2rem] leading-[2.05] border-s-[3px] border-saffron ps-4 whitespace-pre-line">${esc(it.text)}</blockquote>
        ${srcLine ? `<p class="mt-4 text-[0.92rem] text-[var(--muted)]">${srcLine}</p>` : ""}${citeBox}${tags}${actions}</article>`;
    case "note":
      return `<article class="rounded-2xl bg-saffron/10 border border-saffron/30 p-5">${head}
        <p dir="auto" class="mt-4 text-[1.05rem] leading-[2] whitespace-pre-line">${esc(it.text)}</p>${tags}${actions}</article>`;
    case "image":
      return `<article class="rounded-2xl border border-[var(--rule)] bg-[var(--bg)] overflow-hidden">
        <button type="button" data-view="${it.id}" class="block w-full bg-[var(--bg-2)]" aria-label="عرض الصورة"><img data-file="${it.file}" alt="" class="w-full h-auto min-h-24" /></button>
        <div class="p-5">${head}
        ${it.text ? `<p dir="auto" class="mt-3 leading-[1.9] whitespace-pre-line">${esc(it.text)}</p>` : ""}
        ${it.source || it.page ? `<p class="mt-2 text-[0.92rem] text-[var(--muted)]">${[it.source, it.page && `ص ${it.page}`].filter(Boolean).map((x) => esc(x!)).join(" · ")}</p>` : ""}
        ${tags}${actions}</div></article>`;
    case "pdf":
      return `<article class="rounded-2xl border border-[var(--rule)] bg-[var(--bg)] p-5">${head}
        <button type="button" data-open-file="${it.id}" class="mt-4 w-full flex gap-4 items-start text-start group">
          <span class="grid place-items-center w-12 h-14 shrink-0 rounded-md bg-glass-red/10 text-glass-red text-[0.8rem] font-bold">PDF</span>
          <span class="min-w-0"><span class="block font-medium leading-snug group-hover:text-indigo dark:group-hover:text-saffron">${esc(it.source || it.fileName || "ملف PDF")}</span>
          <span class="block mt-1 text-[0.88rem] text-[var(--muted)]">${it.fileSize ? `${mb(it.fileSize)} ميغابايت · ` : ""}اضغط للفتح</span></span>
        </button>
        ${it.text ? `<p dir="auto" class="mt-3 leading-[1.9] whitespace-pre-line">${esc(it.text)}</p>` : ""}${tags}${actions}</article>`;
    case "ref": {
      const ref = apa(it);
      return `<article class="rounded-2xl border border-[var(--rule)] bg-[var(--bg)] p-5">${head}
        <p class="mt-4 leading-[1.95] ps-6 -indent-6" ${isLatin(it.author || it.source) ? 'dir="ltr" style="text-align:left"' : ""}>${ref}</p>
        <div class="mt-3 flex flex-wrap gap-4 text-[0.88rem]">
          <button type="button" data-copy-apa="${it.id}" class="text-indigo dark:text-saffron font-medium">نسخ بنمط APA</button>
          ${cite ? `<button type="button" data-copy-cite="${it.id}" class="text-indigo dark:text-saffron font-medium">نسخ التوثيق</button>` : ""}
          ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="text-glass-blue no-underline">فتح الرابط ↗</a>` : ""}
        </div>${tags}${actions}</article>`;
    }
  }
}

async function renderUsage() {
  const files = await all<StoredFile>("files");
  const size = files.reduce((s, f) => s + f.blob.size, 0);
  $("nb-usage").innerHTML = `${count(items.length, "عنصر واحد", "عنصران", "عناصر", "عنصرًا")} · الملفات: <b class="text-[var(--fg)]">${mb(size)}</b> ميغابايت`;
}

function renderDatalists() {
  const uniq = (f: (i: Item) => string | undefined) => [...new Set(items.map(f).filter(Boolean))] as string[];
  $("dl-authors").innerHTML = uniq((i) => i.author).map((v) => `<option value="${esc(v)}">`).join("");
  $("dl-sources").innerHTML = uniq((i) => i.source).map((v) => `<option value="${esc(v)}">`).join("");
  $("dl-publishers").innerHTML = uniq((i) => i.publisher).map((v) => `<option value="${esc(v)}">`).join("");
}

async function render() {
  if (state.project !== "all" && !projects.some((p) => p.id === state.project)) state.project = "all";
  renderProjects(); renderHeader(); renderTypes(); renderTags(); renderDatalists();
  await renderList(); renderUsage();
}
async function reload() {
  projects = (await all<Project>("projects")).sort((a, b) => a.created - b.created);
  items = await all<Item>("items");
  await render();
}

// قائمة خيارات في النافذة المنبثقة
function sheet(title: string, actions: { label: string; danger?: boolean; run: () => void }[]) {
  const dlg = $<HTMLDialogElement>("nb-dialog");
  $("nb-dialog-title").textContent = title;
  $("nb-dialog-body").innerHTML = `<div class="grid gap-2">${actions.map((a, i) =>
    `<button type="button" data-sheet="${i}" class="w-full text-start px-4 py-3 rounded-xl border border-[var(--rule)] hover:bg-[var(--bg-2)] ${a.danger ? "text-glass-red" : ""}">${esc(a.label)}</button>`).join("")}</div>`;
  $("nb-dialog-body").querySelectorAll<HTMLElement>("[data-sheet]").forEach((b) =>
    b.addEventListener("click", () => { dlg.close(); actions[+b.dataset.sheet!].run(); }));
  dlg.showModal();
}

// ---------- المشاريع ----------
async function newProject() {
  const name = prompt("اسم المشروع الجديد:")?.trim();
  if (!name) return;
  const p = { id: uid(), name, created: Date.now() };
  await put("projects", p);
  state.project = p.id; saveView();
  await reload();
  toast("أُنشئ المشروع");
}
function projectMenu(id: string) {
  const p = projects.find((x) => x.id === id); if (!p) return;
  sheet(`المشروع: ${p.name}`, [
    { label: "إعادة تسمية المشروع", run: async () => {
      const name = prompt("الاسم الجديد:", p.name)?.trim();
      if (name && name !== p.name) { await put("projects", { ...p, name }); await reload(); }
    } },
    { label: "حذف المشروع وكل عناصره", danger: true, run: async () => {
      const n = items.filter((i) => i.project === id).length;
      if (!confirm(n ? `حذف المشروع «${p.name}» وكل عناصره (${arNum(n)})؟ لا يمكن التراجع.` : `حذف المشروع «${p.name}»؟`)) return;
      for (const it of items.filter((i) => i.project === id)) await removeItem(it, false);
      await del("projects", id);
      if (state.project === id) { state.project = "all"; saveView(); }
      await reload();
    } },
  ]);
}

// ---------- نافذة الإضافة ----------
let editing: Item | null = null;
let formKind: Kind = "quote";
let pendingFile: File | Blob | null = null;
let pendingName = "";
const F = (id: string) => $<HTMLInputElement>(id);

function setFormKind(k: Kind) {
  formKind = k;
  $("nb-form-types").innerHTML = KINDS.map((x) =>
    `<button type="button" role="tab" aria-selected="${x.key === k}" data-form-kind="${x.key}" class="py-2 rounded-lg ${x.key === k ? "bg-[var(--bg)] shadow-sm font-bold" : "text-[var(--muted)]"}">${x.label}</button>`).join("");
  document.querySelectorAll<HTMLElement>("#nb-form [data-show]").forEach((el) => { el.hidden = !el.dataset.show!.split(" ").includes(k); });
  $("f-text-label").textContent = { quote: "النص المقتبس", note: "الفكرة", image: "وصف الصورة (اختياري)", pdf: "ملاحظة (اختيارية)", ref: "" }[k];
  $("f-source-label").textContent = k === "ref" ? "عنوان الكتاب أو المقال" : k === "pdf" ? "عنوان الملف" : "الكتاب أو المصدر";
  F("f-file").accept = k === "image" ? "image/*" : "application/pdf";
  preview();
}
function preview() {
  const it = { author: F("f-author").value, year: F("f-year").value, page: F("f-page").value, source: F("f-source").value, publisher: F("f-publisher").value, url: F("f-url").value };
  const p = $("f-preview");
  if (formKind === "ref") { const a = apa(it); p.innerHTML = a ? `المرجع: ${a}` : "يظهر المرجع بنمط APA هنا"; }
  else { const c = citation(it); p.innerHTML = c ? `التوثيق: <b>${esc(c)}</b>` : "يظهر التوثيق هنا عند كتابة المؤلف والسنة"; }
}
function setFile(f: File | Blob | null, name = "") {
  pendingFile = f; pendingName = name;
  $("f-file-name").textContent = f ? `✓ ${name || "صورة من الحافظة"}` : editing?.file ? `الملف الحالي: ${editing.fileName || ""} (اختر ملفًا لاستبداله)` : "اسحب الملف هنا أو اضغط للاختيار";
}
function openForm(it: Item | null = null, kind: Kind = "quote") {
  editing = it;
  $("nb-form-title").textContent = it ? "تعديل العنصر" : "إضافة إلى الأرشيف";
  const v = (x?: string) => x || "";
  F("f-text").value = v(it?.text); F("f-source").value = v(it?.source); F("f-author").value = v(it?.author);
  F("f-year").value = v(it?.year); F("f-page").value = v(it?.page); F("f-page2").value = v(it?.page);
  F("f-publisher").value = v(it?.publisher); F("f-url").value = v(it?.url); F("f-tags").value = it ? it.tags.join(" ") : (state.tag || "");
  const sel = $<HTMLSelectElement>("f-project");
  sel.innerHTML = projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("") + `<option value="__new">+ مشروع جديد…</option>`;
  sel.value = it?.project || (state.project !== "all" ? state.project : projects[0]?.id || "");
  $("f-error").hidden = true;
  setFile(null);
  setFormKind(it?.type || kind);
  $("nb-drawer").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => (formKind === "ref" ? F("f-author") : F("f-text")).focus(), 50);
}
function closeForm() { $("nb-drawer").hidden = true; document.body.style.overflow = ""; editing = null; }

async function compressImage(f: Blob): Promise<Blob> {
  if (f.type === "image/gif" || f.type === "image/svg+xml") return f;
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && f.size < 600 * 1024) return f;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return out && out.size < f.size ? out : f;
  } catch { return f; }
}

async function submitForm(e: Event) {
  e.preventDefault();
  const err = (m: string) => { const el = $("f-error"); el.textContent = m; el.hidden = false; };
  const text = F("f-text").value.trim();
  if ((formKind === "quote" || formKind === "note") && !text) return err(formKind === "quote" ? "اكتب النص المقتبس." : "اكتب الفكرة.");
  if ((formKind === "image" || formKind === "pdf") && !pendingFile && !(editing?.file && editing.type === formKind)) return err("اختر الملف.");
  if (formKind === "ref" && !F("f-source").value.trim() && !F("f-author").value.trim()) return err("اكتب عنوان المرجع أو مؤلفه.");
  if (pendingFile && pendingFile.size > MAX_FILE) return err(`الملف أكبر من ${mb(MAX_FILE)} ميغابايت.`);

  let project = $<HTMLSelectElement>("f-project").value;
  if (!project || project === "__new") {
    const name = project === "__new" ? prompt("اسم المشروع الجديد:")?.trim() : "عام";
    if (!name) return;
    const p = { id: uid(), name, created: Date.now() };
    await put("projects", p); projects.push(p); project = p.id;
  }
  const now = Date.now();
  const it: Item = {
    id: editing?.id || uid(), type: formKind, project,
    text: formKind === "ref" ? undefined : text || undefined,
    source: F("f-source").value.trim() || undefined,
    author: ["quote", "ref"].includes(formKind) ? F("f-author").value.trim() || undefined : undefined,
    year: ["quote", "ref"].includes(formKind) ? F("f-year").value.trim() || undefined : undefined,
    page: formKind === "quote" ? F("f-page").value.trim() || undefined : ["image", "pdf"].includes(formKind) ? F("f-page2").value.trim() || undefined : undefined,
    publisher: formKind === "ref" ? F("f-publisher").value.trim() || undefined : undefined,
    url: formKind === "ref" ? F("f-url").value.trim() || undefined : undefined,
    tags: parseTags(F("f-tags").value),
    created: editing?.created || now, updated: now,
  };
  if (formKind === "image" || formKind === "pdf") {
    if (pendingFile) {
      const blob = formKind === "image" ? await compressImage(pendingFile) : pendingFile;
      const fid = uid();
      await put("files", { id: fid, blob, name: pendingName, type: blob.type } satisfies StoredFile);
      if (editing?.file) await del("files", editing.file);
      it.file = fid; it.fileName = pendingName || (formKind === "image" ? "صورة" : "ملف.pdf"); it.fileSize = blob.size;
    } else if (editing) { it.file = editing.file; it.fileName = editing.fileName; it.fileSize = editing.fileSize; }
  } else if (editing?.file) await del("files", editing.file);
  await put("items", it);
  const wasEdit = !!editing;
  closeForm();
  if (state.project !== "all" && state.project !== it.project) { state.project = it.project; saveView(); }
  await reload();
  toast(wasEdit ? "حُفظ التعديل" : "حُفظ في الأرشيف");
}

async function removeItem(it: Item, ask = true) {
  if (ask && !confirm("حذف هذا العنصر نهائيًا؟")) return;
  if (it.file) await del("files", it.file);
  await del("items", it.id);
  if (ask) { await reload(); toast("حُذف"); }
}

// ---------- قائمة المراجع ----------
function bibliography() {
  const scope = items.filter(inScope).filter((i) => (i.type === "quote" || i.type === "ref") && (i.source || i.author));
  const map = new Map<string, Item>();
  for (const i of scope) {
    const key = [i.author, i.source, i.year].map((x) => (x || "").trim().toLowerCase()).join("|");
    const prev = map.get(key);
    if (!prev || (i.type === "ref" && prev.type !== "ref")) map.set(key, i);
  }
  const refs = [...map.values()].sort((a, b) => {
    const la = isLatin(a.author || a.source), lb = isLatin(b.author || b.source);
    if (la !== lb) return la ? 1 : -1;
    return (a.author || a.source || "").localeCompare(b.author || b.source || "", la ? "en" : "ar");
  });
  const p = projects.find((x) => x.id === state.project);
  $("nb-dialog-title").textContent = `قائمة المراجع${p ? `: ${p.name}` : ""}`;
  $("nb-dialog-body").innerHTML = refs.length
    ? `<p class="text-[0.9rem] text-[var(--muted)]">مرتبة هجائيًا بنمط APA، المراجع العربية ثم الأجنبية. جُمعت من المقتبسات والمراجع في ${p ? "هذا المشروع" : "الأرشيف"}.</p>
       <ol class="mt-4 space-y-3">${refs.map((r) => `<li class="leading-[1.95] ps-6 -indent-6" ${isLatin(r.author || r.source) ? 'dir="ltr" style="text-align:left"' : ""}>${apa(r)}</li>`).join("")}</ol>
       <button type="button" id="nb-copy-bib" class="mt-6 w-full py-3 rounded-xl bg-indigo text-white font-bold dark:bg-saffron dark:text-ink">نسخ القائمة كاملة</button>`
    : `<p class="text-[var(--muted)] leading-[2]">لا مراجع بعد. أضف مقتبسات بمؤلفها وكتابها، أو أضف مراجع، وتُبنى القائمة منها تلقائيًا.</p>`;
  $("nb-copy-bib")?.addEventListener("click", () => copy(refs.map((r) => apa(r, false)).join("\n"), "نُسخت قائمة المراجع"));
  $<HTMLDialogElement>("nb-dialog").showModal();
}

async function viewImage(it: Item) {
  const f = it.file && (await getFile(it.file)); if (!f) return;
  const u = URL.createObjectURL(f.blob); objectUrls.push(u);
  $("nb-dialog-title").textContent = it.source || "صورة";
  $("nb-dialog-body").innerHTML = `<img src="${u}" alt="" class="w-full h-auto rounded-lg" />${it.text ? `<p class="mt-3 leading-[1.9]">${esc(it.text)}</p>` : ""}
    <a href="${u}" download="${esc(it.fileName || "image.jpg")}" class="mt-4 inline-block text-indigo dark:text-saffron">تنزيل الصورة</a>`;
  $<HTMLDialogElement>("nb-dialog").showModal();
}
async function openFile(it: Item) {
  const f = it.file && (await getFile(it.file)); if (!f) return toast("الملف غير موجود");
  const u = URL.createObjectURL(f.blob);
  const w = window.open(u, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = u; a.download = it.fileName || "file.pdf"; a.click(); }
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

// ---------- التصدير والاستيراد ----------
const blobToB64 = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r((fr.result as string).split(",")[1]); fr.readAsDataURL(b); });
async function exportAll() {
  const files = await all<StoredFile>("files");
  const data = {
    app: "researcher-notebook", version: 1, exported: new Date().toISOString(), projects, items,
    files: await Promise.all(files.map(async (f) => ({ id: f.id, name: f.name, type: f.type, data: await blobToB64(f.blob) }))),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = `مفكرة-الباحث-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast("نُزّلت النسخة الاحتياطية");
}
async function importAll(file: File) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "researcher-notebook") throw new Error();
    if (!confirm(`استيراد ${arNum(data.items?.length || 0)} عنصرًا و${arNum(data.projects?.length || 0)} مشروعًا؟ العناصر الموجودة تبقى كما هي.`)) return;
    // المشاريع بالاسم نفسه تُدمج، فلا يتكرر «عام» مثلًا
    const remap = new Map<string, string>();
    for (const p of data.projects || []) {
      const same = projects.find((x) => x.name.trim() === String(p.name).trim() && x.id !== p.id);
      if (same) remap.set(p.id, same.id); else await put("projects", p);
    }
    for (const f of data.files || []) {
      const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      await put("files", { id: f.id, name: f.name, type: f.type, blob: new Blob([bin], { type: f.type }) });
    }
    for (const it of data.items || []) await put("items", { ...it, project: remap.get(it.project) || it.project });
    await reload();
    toast("تم الاستيراد");
  } catch { alert("هذا الملف ليس نسخة احتياطية من مفكرة الباحث."); }
}

// ---------- الأحداث ----------
function bind() {
  document.addEventListener("click", async (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("button, [data-action]");
    if (!el) return;
    const d = el.dataset;
    const find = (id?: string) => items.find((i) => i.id === id);
    if (d.project) { state.project = d.project; state.tag = ""; saveView(); render(); }
    else if (d.projectMenu) projectMenu(d.projectMenu);
    else if (d.kind) { state.kind = d.kind as Kind | "all"; renderTypes(); renderList(); }
    else if (d.tag) { state.tag = state.tag === d.tag ? "" : d.tag; renderTags(); renderList(); }
    else if (d.edit) openForm(find(d.edit));
    else if (d.delete) { const it = find(d.delete); if (it) removeItem(it); }
    else if (d.copyCite) { const it = find(d.copyCite); if (it) copy(citation(it), "نُسخ التوثيق"); }
    else if (d.copyApa) { const it = find(d.copyApa); if (it) copy(apa(it, false), "نُسخ المرجع"); }
    else if (d.copyText) { const it = find(d.copyText); if (it) copy([it.text, it.type === "ref" ? apa(it, false) : citation(it)].filter(Boolean).join(" "), "نُسخ"); }
    else if (d.view) { const it = find(d.view); if (it) viewImage(it); }
    else if (d.openFile) { const it = find(d.openFile); if (it) openFile(it); }
    else if (d.formKind) setFormKind(d.formKind as Kind);
    else if (d.action === "add") openForm(null, state.kind === "all" ? "quote" : state.kind);
    else if ("close" in d) closeForm();
    else if ("dialogClose" in d) $<HTMLDialogElement>("nb-dialog").close();
  });
  $("nb-add").addEventListener("click", () => openForm(null, state.kind === "all" ? "quote" : state.kind));
  $("nb-bib").addEventListener("click", bibliography);
  $("nb-new-project").addEventListener("click", newProject);
  $("nb-export").addEventListener("click", exportAll);
  $<HTMLInputElement>("nb-import").addEventListener("change", (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) importAll(f); (e.target as HTMLInputElement).value = ""; });
  $<HTMLSelectElement>("nb-project-select").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v === "__new") { newProject(); (e.target as HTMLSelectElement).value = state.project; return; }
    state.project = v; state.tag = ""; saveView(); render();
  });
  $("nb-more").addEventListener("click", () => {
    const acts = [
      { label: "قائمة المراجع APA", run: bibliography },
      { label: "تصدير نسخة احتياطية", run: exportAll },
      { label: "استيراد نسخة احتياطية", run: () => $("nb-import").click() },
    ];
    if (state.project !== "all") acts.push({ label: "إعادة تسمية المشروع أو حذفه", run: () => projectMenu(state.project) });
    sheet("خيارات", acts);
  });
  let t: number | undefined;
  $<HTMLInputElement>("nb-search").addEventListener("input", (e) => { clearTimeout(t); t = window.setTimeout(() => { state.q = (e.target as HTMLInputElement).value; renderList(); }, 120); });

  // النافذة
  $("nb-form").addEventListener("submit", submitForm);
  $("nb-drawer").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeForm(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("nb-drawer").hidden) closeForm(); });
  ["f-author", "f-year", "f-page", "f-source", "f-publisher", "f-url"].forEach((id) => F(id).addEventListener("input", preview));
  F("f-file").addEventListener("change", () => { const f = F("f-file").files?.[0]; if (f) setFile(f, f.name); F("f-file").value = ""; });
  const drop = $("f-drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("border-indigo"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("border-indigo"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("border-indigo");
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    const isImg = f.type.startsWith("image/"), isPdf = f.type === "application/pdf";
    if (!isImg && !isPdf) return toast("الملف يجب أن يكون صورة أو PDF");
    if (isImg !== (formKind === "image")) setFormKind(isImg ? "image" : "pdf");
    setFile(f, f.name);
  });
  document.addEventListener("paste", (e) => {
    if ($("nb-drawer").hidden) return;
    const f = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (!f) return;
    e.preventDefault();
    if (formKind !== "image") setFormKind("image");
    setFile(f, f.name && f.name !== "image.png" ? f.name : "صورة من الحافظة.png");
  });
  $<HTMLDialogElement>("nb-dialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close(); });
}

// ---------- البدء ----------
(async () => {
  try {
    db = await openDB();
  } catch {
    $("nb-empty").hidden = false;
    $("nb-empty").innerHTML = `<p class="text-center text-glass-red py-10">لا يسمح هذا المتصفح بحفظ البيانات (قد تكون في وضع التصفح الخاص). افتح الصفحة في نافذة عادية.</p>`;
    return;
  }
  navigator.storage?.persist?.().catch(() => {});
  if (!(await all<Project>("projects")).length) await put("projects", { id: uid(), name: "عام", created: Date.now() });
  bind();
  await reload();
})();
