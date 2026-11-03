import { describe, expect, it } from 'vitest';
import { writeLines } from '../../src/debug/address';

const US = [
  [{ field: 'first_name' }, { text: ' ' }, { field: 'last_name' }],
  [{ field: 'line1' }],
  [{ field: 'line2' }],
  [{ field: 'city' }, { text: ', ' }, { field: 'state' }, { text: ' ' }, { field: 'postcode' }],
  [{ field: 'country' }],
];

describe('written address', () => {
  it("writes each line as i18n-rules' formatAddress does, leaving out empty fields and their text", () => {
    expect(
      writeLines(US, { first_name: 'Jane', city: 'Mountain View', postcode: '94043', country: 'United States' }),
    ).toEqual(['Jane', 'Mountain View 94043', 'United States']);
    expect(
      writeLines([[{ text: '〒' }, { field: 'postcode' }], [{ text: 'JAPAN' }]], { postcode: '100-0001' }),
    ).toEqual(['〒100-0001', 'JAPAN']);
    expect(writeLines([[{ text: '〒' }, { field: 'postcode' }]], {})).toEqual([]);
  });
});
