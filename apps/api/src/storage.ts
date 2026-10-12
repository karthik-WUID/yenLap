import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { ObjectStorage } from './providers';
const root = process.env.STORAGE_DIR || './data/private';
async function key() {
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (process.env.STORAGE_KEY) {
        const value = Buffer.from(process.env.STORAGE_KEY, 'hex');
        if (value.length !== 32)
            throw Error('STORAGE_KEY must be 32 bytes hex');
        return value;
    }
    if (process.env.NODE_ENV === 'production')
        throw Error('Production encryption key required');
    const file = join(root, '.key');
    try {
        return await readFile(file);
    }
    catch (e: any) {
        if (e.code !== 'ENOENT')
            throw e;
        const value = randomBytes(32);
        await writeFile(file, value, { mode: 0o600, flag: 'wx' });
        return value;
    }
}
function path(k: string) {
    if (!/^[a-f0-9-]{36}$/.test(k))
        throw Error('Invalid object key');
    return join(root, k + '.enc');
}
export const storage: ObjectStorage = { async put(k, bytes) { const secret = await key(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv); const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]); await writeFile(path(k), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 }); }, async get(k) { const secret = await key(), data = await readFile(path(k)), decipher = createDecipheriv('aes-256-gcm', secret, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]); }, async delete(k) { await unlink(path(k)); } };
