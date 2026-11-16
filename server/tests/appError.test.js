import { describe, it, expect } from 'vitest';
import AppError from '../src/utils/AppError.js';

describe('AppError codes', () => {
  it('derives a code from the status when none is given', () => {
    expect(new AppError('bad', 400).code).toBe('VALIDATION_ERROR');
    expect(new AppError('missing', 404).code).toBe('NOT_FOUND');
    expect(new AppError('boom').code).toBe('INTERNAL_ERROR');
  });

  it('keeps an explicit code', () => {
    expect(new AppError('cap', 409, 'RECORD_LIMIT').code).toBe('RECORD_LIMIT');
  });
});
