const { validStudentId } = require('../src/supabaseClasses');

describe('Supabase UUID validation', () => {
  test('accepts a canonical UUID', () => {
    expect(validStudentId('00000000-0000-4000-8000-000000000001')).toBe(true);
  });

  test('rejects legacy external IDs and malformed values', () => {
    expect(validStudentId('student-1')).toBe(false);
    expect(validStudentId('00000000-0000-4000-8000-00000000000z')).toBe(false);
  });
});
