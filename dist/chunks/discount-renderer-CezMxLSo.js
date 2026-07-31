import { c as formatDiscountPercentage, f as formatCurrency } from "./debug-DwIz_ASh.js";
function replaceVarsPreservingTemplates(html, vars) {
  const parts = html.split(/(<template[\s\S]*?<\/template>)/gi);
  return parts.map(
    (part, i) => i % 2 === 1 ? part : part.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "")
  ).join("");
}
function renderDiscountContainers(root, data) {
  root.querySelectorAll("[data-next-discounts]").forEach((container) => {
    const filter = container.getAttribute("data-next-discounts") ?? "";
    let items;
    switch (filter) {
      case "offer":
        items = data.offerDiscounts;
        break;
      case "voucher":
        items = data.voucherDiscounts;
        break;
      default:
        items = [...data.offerDiscounts, ...data.voucherDiscounts];
        break;
    }
    renderInto(container, items);
  });
}
function renderFlatDiscountContainers(root, discounts) {
  root.querySelectorAll("[data-next-discounts]").forEach((container) => {
    renderInto(container, discounts);
  });
}
function renderInto(container, items) {
  const tpl = container.querySelector(
    ":scope > template"
  );
  if (!tpl) return;
  const templateHTML = tpl.innerHTML.trim();
  clearChildren(container);
  const empty = items.length === 0;
  container.classList.toggle("next-discounts-empty", empty);
  container.classList.toggle("next-discounts-has-items", !empty);
  for (const d of items) {
    const html = renderItem(templateHTML, d);
    const node = htmlToNode(html);
    if (node) container.appendChild(node);
  }
}
function renderItem(template, d) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    switch (key) {
      case "discount.name":
        return d.name ?? "";
      case "discount.amount":
        return formatCurrency(d.amount);
      case "discount.description":
        return d.description ?? "";
      case "discount.percentage":
        return formatDiscountPercentage(d.percentage);
      default:
        return "";
    }
  });
}
function htmlToNode(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}
function clearChildren(container) {
  for (const node of Array.from(container.childNodes)) {
    if (node.tagName?.toLowerCase() !== "template") {
      node.parentNode?.removeChild(node);
    }
  }
}
export {
  renderFlatDiscountContainers as a,
  replaceVarsPreservingTemplates as b,
  renderDiscountContainers as r
};
