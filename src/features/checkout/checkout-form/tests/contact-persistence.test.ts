import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Iti } from 'intl-tel-input';
import type { Logger } from '@/core/logger';
import {
  persistContactField,
  type ContactPersistenceContext,
} from '../contact-persistence';
import type { ProspectCartEnhancer } from '../../prospect-cart/prospect-cart.enhancer';

// Declared via `vi.hoisted` so the hoisted `vi.mock` factory and the tests share one
// spy — the pattern `autofill-detection.test.ts` uses.
const { updateUserDataMock } = vi.hoisted(() => ({
  updateUserDataMock: vi.fn(),
}));

vi.mock('@/core/analytics/user-data-storage', () => ({
  userDataStorage: { updateUserData: updateUserDataMock },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(
  options: { withProspectCart?: boolean; phoneNumber?: string | null } = {}
): {
  ctx: ContactPersistenceContext;
  logger: ReturnType<typeof createMockLogger>;
  updateEmail: ReturnType<typeof vi.fn>;
  checkAndCreateCart: ReturnType<typeof vi.fn>;
} {
  const logger = createMockLogger();
  const updateEmail = vi.fn();
  const checkAndCreateCart = vi.fn();

  const phoneInputs = new Map<string, Iti>();
  if (options.phoneNumber !== undefined) {
    phoneInputs.set('shipping', {
      getNumber: vi.fn(() => options.phoneNumber),
    } as unknown as Iti);
  }

  const ctx: ContactPersistenceContext = {
    prospectCartEnhancer:
      options.withProspectCart === false
        ? undefined
        : ({
            updateEmail,
            checkAndCreateCart,
          } as unknown as ProspectCartEnhancer),
    phoneInputs,
    logger: logger as unknown as Logger,
  };

  return { ctx, logger, updateEmail, checkAndCreateCart };
}

beforeEach(() => {
  updateUserDataMock.mockClear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('persistContactField', () => {
  it('keeps the prospect cart email in step', () => {
    const { ctx, updateEmail } = createCtx();

    persistContactField(ctx, 'email', 'ada@example.com');

    expect(updateEmail).toHaveBeenCalledWith('ada@example.com');
  });

  it('writes email, first name and last name to user-data storage', () => {
    const { ctx } = createCtx();

    persistContactField(ctx, 'email', 'ada@example.com');
    persistContactField(ctx, 'fname', 'Ada');
    persistContactField(ctx, 'lname', 'Lovelace');

    expect(updateUserDataMock.mock.calls).toEqual([
      [{ email: 'ada@example.com' }],
      [{ firstName: 'Ada' }],
      [{ lastName: 'Lovelace' }],
    ]);
  });

  it('stores the phone in E.164 when the library parsed it', () => {
    const { ctx } = createCtx({ phoneNumber: '+447700900123' });

    persistContactField(ctx, 'phone', '07700 900123');

    expect(updateUserDataMock).toHaveBeenCalledWith({
      phone: '+447700900123',
    });
  });

  it('stores the typed phone when the library cannot parse it', () => {
    const { ctx } = createCtx({ phoneNumber: null });

    persistContactField(ctx, 'phone', '07700');

    expect(updateUserDataMock).toHaveBeenCalledWith({ phone: '07700' });
  });

  it('stores the typed phone when no instance exists', () => {
    const { ctx } = createCtx();

    persistContactField(ctx, 'phone', '07700 900123');

    expect(updateUserDataMock).toHaveBeenCalledWith({
      phone: '07700 900123',
    });
  });

  it('logs the value it stored under the storage key, not the field name', () => {
    const { ctx, logger } = createCtx();

    persistContactField(ctx, 'fname', 'Ada');

    expect(logger.debug).toHaveBeenCalledWith(
      'Updated user data storage:',
      'fname',
      'Ada'
    );
  });

  it('asks the prospect cart to create itself for the three fields it needs', () => {
    const { ctx, checkAndCreateCart } = createCtx();

    persistContactField(ctx, 'email', 'ada@example.com');
    persistContactField(ctx, 'fname', 'Ada');
    persistContactField(ctx, 'lname', 'Lovelace');

    expect(checkAndCreateCart).toHaveBeenCalledTimes(3);
  });

  it('ignores a field that is neither stored nor a prospect-cart trigger', () => {
    const { ctx, updateEmail, checkAndCreateCart } = createCtx();

    persistContactField(ctx, 'address1', '10 Downing Street');

    expect(updateUserDataMock).not.toHaveBeenCalled();
    expect(updateEmail).not.toHaveBeenCalled();
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });

  it('still writes user-data storage when there is no prospect cart', () => {
    const { ctx } = createCtx({ withProspectCart: false });

    persistContactField(ctx, 'email', 'ada@example.com');

    expect(updateUserDataMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
    });
  });

  /**
   * DEFECT (left as found): the value is stored exactly as typed.
   *
   * The validation that runs a line earlier in `handleFieldChange` trims before judging,
   * so `" ada@example.com "` is pronounced valid and then persisted with its spaces. The
   * shopper sees a tick and the recovery email goes to an address with a leading space.
   */
  it('DEFECT: persists an untrimmed value that validation accepted trimmed', () => {
    const { ctx } = createCtx();

    persistContactField(ctx, 'email', '  ada@example.com  ');

    expect(updateUserDataMock).toHaveBeenCalledWith({
      email: '  ada@example.com  ',
    });
  });
});
