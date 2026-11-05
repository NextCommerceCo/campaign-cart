import { createActions } from '../engine/actions';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/params';

/** The actions `next.actions` and `data-next-action` share, made once per page. */
export const pageActions = (engine: Engine) =>
  createActions(engine, {
    page: () => location.pathname,
    navigate: (url) => location.assign(url),
    url: (target) => nextUrl(target, new URL(location.href), engine.getState().visit.params),
  });
