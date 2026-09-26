/*
 * Paginator for uhd-tech-docs documents (runs once in headless Chrome at
 * build time; the saved HTML is already paginated, so this script is removed).
 *
 * Blocks in #flow are poured into A4 page frames cloned from #page-template:
 *   data-page="cover|full"   the block is a whole page of its own
 *   data-break="before"      start a new page before the block
 *   .sec / .sub / .keep-next  kept with the following block
 *   table.split              may split between rows (header repeated, "continued")
 * Pages whose body still overflows are marked .overflow (the verifier fails them).
 */
(function () {
  const tpl = document.getElementById("page-template");
  const pagesEl = document.getElementById("pages");
  const flow = document.getElementById("flow");
  const pages = [];
  let body = null;

  function newPage(kind) {
    const page = tpl.content.firstElementChild.cloneNode(true);
    if (kind) page.classList.add(kind);
    pagesEl.appendChild(page);
    pages.push(page);
    body = page.querySelector(".pg-body");
    return page;
  }
  const overflows = () => body.scrollHeight > body.clientHeight + 1;
  const isKeepNext = (el) => el && (el.matches(".sec, .sub, .keep-next") || el.dataset.keepNext === "1");

  function moveTrailingHeadings() {
    const moved = [];
    while (body.lastElementChild && isKeepNext(body.lastElementChild) && body.children.length > 1) {
      moved.unshift(body.lastElementChild);
      body.removeChild(body.lastElementChild);
    }
    return moved;
  }

  function splitTable(block) {
    // block is (or wraps) table.split; move rows to a continuation until the page fits
    const table = block.matches("table.split") ? block : block.querySelector("table.split");
    if (!table) return null;
    const rows = [...table.tBodies[0].rows];
    if (rows.length < 4) return null;
    const cont = block.cloneNode(true);
    const ctable = cont.matches("table.split") ? cont : cont.querySelector("table.split");
    ctable.tBodies[0].innerHTML = "";
    cont.querySelectorAll(".cap, figcaption").forEach((c) => c.remove());
    cont.classList.add("continued");
    let moved = 0;
    while (overflows() && table.tBodies[0].rows.length > 2) {
      const last = table.tBodies[0].rows[table.tBodies[0].rows.length - 1];
      ctable.tBodies[0].insertBefore(last, ctable.tBodies[0].firstChild);
      moved++;
    }
    // avoid orphaned group headings at the bottom
    const lastRow = table.tBodies[0].rows[table.tBodies[0].rows.length - 1];
    if (lastRow && lastRow.classList.contains("group") && table.tBodies[0].rows.length > 1) {
      ctable.tBodies[0].insertBefore(lastRow, ctable.tBodies[0].firstChild);
      moved++;
    }
    if (overflows() || table.tBodies[0].rows.length < 2) {
      // could not fit even two rows: give the rows back and move the whole block
      while (ctable.tBodies[0].rows.length) table.tBodies[0].appendChild(ctable.tBodies[0].rows[0]);
      return null;
    }
    return moved ? cont : null;
  }

  function place(block) {
    if (!body) newPage();
    if (block.dataset.page) {
      if (body.children.length) newPage(block.dataset.page);
      else pages[pages.length - 1].classList.add(block.dataset.page);
      body.appendChild(block);
      if (overflows()) pages[pages.length - 1].classList.add("overflow");
      body = null;
      return;
    }
    if (block.dataset.break === "before" && body.children.length) newPage();
    body.appendChild(block);
    if (!overflows()) return;
    const cont = splitTable(block);
    if (cont) {
      newPage();
      place(cont);
      return;
    }
    if (body.children.length === 1) {
      pages[pages.length - 1].classList.add("overflow");
      return;
    }
    body.removeChild(block);
    const carry = moveTrailingHeadings();
    newPage();
    for (const c of carry) body.appendChild(c);
    place(block);
  }

  const blocks = [...flow.children];
  for (const b of blocks) place(b);
  flow.remove();

  // page numbers, table of contents
  const total = pages.length;
  pages.forEach((p, i) => {
    const n = p.querySelector(".pg-num");
    if (n) n.textContent = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    p.dataset.page = String(i + 1);
    if (p.querySelector(".pg-body").scrollHeight > p.querySelector(".pg-body").clientHeight + 1) p.classList.add("overflow");
  });
  document.querySelectorAll("ol.toc").forEach((toc) => {
    const items = [];
    pages.forEach((p, i) => p.querySelectorAll("h1.sec, .step-head h2").forEach((h) => items.push({ t: h.dataset.toc || h.textContent.trim(), n: h.dataset.num || "", page: i + 1 })));
    toc.innerHTML = items
      .map((it) => `<li><span class="toc-n">${it.n}</span><span class="toc-t">${it.t}</span><span class="toc-dots"></span><span class="toc-p">${String(it.page).padStart(2, "0")}</span></li>`)
      .join("");
  });
  document.getElementById("page-template").remove();
  document.body.dataset.pages = String(total);
  window.__flowDone = true;
})();
