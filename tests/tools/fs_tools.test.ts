import { describe, it, expect } from 'vitest';
import { isSafePath } from '../../src/tools/fs_tools.js';
import * as path from 'path';

describe('Security Sandbox: isSafePath', () => {
    it('debe permitir rutas relativas válidas dentro del workspace', () => {
        const result = isSafePath('test.txt');
        expect(result.safe).toBe(true);
        expect(result.fullPath).toContain('workspace');
    });

    it('debe permitir carpetas dentro del workspace', () => {
        const result = isSafePath('src/main.ts');
        expect(result.safe).toBe(true);
    });

    it('debe BLOQUEAR intentos de Path Traversal (../../)', () => {
        const result = isSafePath('../../../etc/passwd');
        expect(result.safe).toBe(false);
    });

    it('debe BLOQUEAR rutas absolutas fuera del workspace', () => {
        const result = isSafePath('C:/Windows/System32/config');
        expect(result.safe).toBe(false);
    });

    it('debe BLOQUEAR ataques de falsos prefijos (starts-with hack)', () => {
        // Si el workspace es /app/workspace, no debe dejar entrar a /app/workspace-hack
        // La validación en fs_tools usa path.sep para evitar esto.
        const result = isSafePath('workspace-hack/virus.js');
        // 'workspace-hack' relativo a process.cwd()/workspace será algo como /app/workspace/workspace-hack
        // Eso es SEGURO. Pero si intento pasar una ruta absoluta que engañe:
        // Necesitamos saber el BASE_WORKSPACE_PATH exacto.
        // Simulamos el ataque con una ruta que empiece igual pero no sea la carpeta
        const mockParent = path.resolve(process.cwd(), './workspace');
        const attackPath = mockParent + '-hack/malware.js';
        const result2 = isSafePath(attackPath);
        expect(result2.safe).toBe(false);
    });
});
