/** An IntersectionObserver the test drives: `visible(el, ratio)` tells every observer watching `el`. */
export class FakeObserver {
  static all: FakeObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
}

export const visible = (el: Element, intersectionRatio: number) =>
  FakeObserver.all
    .filter((o) => o.targets.has(el))
    .forEach((o) =>
      o.callback(
        [{ target: el, intersectionRatio, isIntersecting: intersectionRatio > 0 } as IntersectionObserverEntry],
        o as unknown as IntersectionObserver,
      ),
    );
