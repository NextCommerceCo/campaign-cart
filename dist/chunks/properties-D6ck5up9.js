function isTruthyVar(value) {
  if (value == null || value === "") return false;
  return value !== "hide" && value !== "false";
}
function applySlotConditionals(root, vars) {
  root.querySelectorAll("[data-next-show]").forEach((el) => {
    const key = el.getAttribute("data-next-show");
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? "" : "none";
      el.removeAttribute("data-next-show");
    }
  });
  root.querySelectorAll("[data-next-hide]").forEach((el) => {
    const key = el.getAttribute("data-next-hide");
    if (key in vars) {
      el.style.display = isTruthyVar(vars[key]) ? "none" : "";
      el.removeAttribute("data-next-hide");
    }
  });
}
function parseExcludeProperty(attr) {
  if (!attr) return void 0;
  const trimmed = attr.trim();
  if (!trimmed) return void 0;
  if (trimmed === "*") return "all";
  const keys = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  return keys.length > 0 ? new Set(keys) : void 0;
}
function applyPropertyExclusion(properties, exclude) {
  if (!exclude || !properties) return properties;
  if (exclude === "all") return void 0;
  const result = Object.fromEntries(Object.entries(properties).filter(([k]) => !exclude.has(k)));
  return Object.keys(result).length > 0 ? result : void 0;
}
function collectDefaultProperties() {
  const result = {};
  document.querySelectorAll(
    "[data-next-default-property]"
  ).forEach((el) => {
    const key = el.getAttribute("data-next-default-property");
    if (key && el.value) result[key] = el.value;
  });
  return result;
}
function mergeWithDefaults(itemProperties) {
  const defaults = collectDefaultProperties();
  const merged = { ...defaults, ...itemProperties ?? {} };
  return Object.keys(merged).length > 0 ? merged : void 0;
}
function attachPropertyListeners(containerEl, properties, onBlur) {
  containerEl.querySelectorAll(
    "input[data-next-property], textarea[data-next-property], select[data-next-property]"
  ).forEach((el) => {
    const key = el.getAttribute("data-next-property");
    if (!key) return;
    el.addEventListener("input", () => {
      if (el.value) {
        properties[key] = el.value;
      } else {
        delete properties[key];
      }
    });
    if (onBlur) el.addEventListener("blur", onBlur);
  });
}
export {
  applySlotConditionals as a,
  applyPropertyExclusion as b,
  attachPropertyListeners as c,
  isTruthyVar as i,
  mergeWithDefaults as m,
  parseExcludeProperty as p
};
