function setupQuantityControls(opts) {
  const { hostEls, getQty, setQty, min, max, onChange, handlers } = opts;
  const increaseBtns = [];
  const decreaseBtns = [];
  const displayEls = [];
  for (const host of hostEls) {
    host.querySelectorAll("[data-next-quantity-increase]").forEach(
      (b) => increaseBtns.push(b)
    );
    host.querySelectorAll("[data-next-quantity-decrease]").forEach(
      (b) => decreaseBtns.push(b)
    );
    host.querySelectorAll("[data-next-quantity-display]").forEach(
      (d) => displayEls.push(d)
    );
  }
  const primaryHost = hostEls[0];
  const updateDisplay = () => {
    const qty = getQty();
    const qtyStr = String(qty);
    for (const el of displayEls) el.textContent = qtyStr;
    if (primaryHost) primaryHost.setAttribute("data-next-quantity", qtyStr);
    const atMin = qty <= min;
    const atMax = qty >= max;
    for (const btn of decreaseBtns) {
      btn.toggleAttribute("disabled", atMin);
      btn.classList.toggle("next-disabled", atMin);
    }
    for (const btn of increaseBtns) {
      btn.toggleAttribute("disabled", atMax);
      btn.classList.toggle("next-disabled", atMax);
    }
  };
  if (increaseBtns.length === 0 && decreaseBtns.length === 0) {
    if (displayEls.length > 0) updateDisplay();
    return updateDisplay;
  }
  for (const btn of increaseBtns) {
    const h = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const current = getQty();
      if (current < max) {
        setQty(current + 1);
        updateDisplay();
        onChange();
      }
    };
    handlers.set(btn, h);
    btn.addEventListener("click", h);
  }
  for (const btn of decreaseBtns) {
    const h = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const current = getQty();
      if (current > min) {
        setQty(current - 1);
        updateDisplay();
        onChange();
      }
    };
    handlers.set(btn, h);
    btn.addEventListener("click", h);
  }
  updateDisplay();
  return updateDisplay;
}
export {
  setupQuantityControls as s
};
