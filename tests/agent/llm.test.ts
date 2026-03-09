import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../../src/agent/llm.js';

describe('LLM Resilience: withRetry (Exponential Backoff)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debe ejecutar la función correctamente si no hay errores', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(mockFn);
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('debe REINTENTAR ante un error 429 (Rate Limit)', async () => {
        const mockFn = vi.fn()
            .mockRejectedValueOnce({ status: 429 }) // 1er intento: falla
            .mockRejectedValueOnce({ status: 429 }) // 2do intento: falla
            .mockResolvedValue('success_after_retry'); // 3er intento: éxito

        const promise = withRetry(mockFn, 3, 1000);

        // Disparamos los timers para saltar los delays de 1s, 2s...
        await vi.runAllTimersAsync();

        const result = await promise;
        expect(result).toBe('success_after_retry');
        expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('debe FALLAR tras agotar los reintentos configurados', async () => {
        const error429 = { status: 429 };
        const mockFn = vi.fn().mockRejectedValue(error429);

        const promise = withRetry(mockFn, 2, 1000);

        // Avanzamos timers para los 2 reintentos
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toEqual(error429);
        expect(mockFn).toHaveBeenCalledTimes(3); // Original + 2 reintentos
    });

    it('NO debe reintentar errores fatales (ej: 401 Unauthorized)', async () => {
        const error401 = { status: 401 };
        const mockFn = vi.fn().mockRejectedValue(error401);

        const promise = withRetry(mockFn);

        await expect(promise).rejects.toEqual(error401);
        expect(mockFn).toHaveBeenCalledTimes(1); // No reintenta
    });
});
