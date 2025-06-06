/*
    @note           as of node 19, webcrypto is now global.
                    update script to work with node 19, until then, build with node 18
                        - https://nodejs.org/id/blog/announcements/v19-release-announce#stable-webcrypto

                        - The WebCrypto API is now stable (with the exception of the following algorithms:
                            Ed25519, Ed448, X25519, and X448)

                        - Use globalThis.crypto or require('node:crypto').webcrypto to access this module.
*/

import { KdbxError } from '../errors/kdbx-error';
import { ErrorCodes } from '../defs/consts';
import { arrayToBuffer, hexToBytes } from '../utils/byte-utils';
import { ChaCha20 } from './chacha20';
import * as nodeCrypto from './crypto';

const EmptySha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const EmptySha512 =
    'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
    '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

// maxRandomQuota is the max number of random bytes you can asks for from the cryptoEngine
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
const MaxRandomQuota = 65536;

export function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!data.byteLength) {
        return Promise.resolve(arrayToBuffer(hexToBytes(EmptySha256)));
    }

    return new Promise((resolve) => {
        const sha = nodeCrypto.createHash('sha256');
        const hash = sha.update(Buffer.from(data)).digest();
        resolve(hash.buffer);
    });
}

export function sha512(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!data.byteLength) {
        return Promise.resolve(arrayToBuffer(hexToBytes(EmptySha512)));
    }

    return new Promise((resolve) => {
        const sha = nodeCrypto.createHash('sha512');
        const hash = sha.update(Buffer.from(data)).digest();
        resolve(hash.buffer);
    });
}

export function hmacSha256(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
        const hmac = nodeCrypto.createHmac('sha256', Buffer.from(key));
        const hash = hmac.update(Buffer.from(data)).digest();
        resolve(hash.buffer);
    });
}

export abstract class AesCbc {
    abstract importKey(key: ArrayBuffer): Promise<void>;
    abstract encrypt(data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
    abstract decrypt(data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
}

class AesCbcNode extends AesCbc {
    private _key: ArrayBuffer | undefined;

    private get key(): ArrayBuffer {
        if (!this._key) {
            throw new KdbxError(ErrorCodes.InvalidState, 'no key');
        }
        return this._key;
    }

    importKey(key: ArrayBuffer): Promise<void> {
        this._key = key;
        return Promise.resolve();
    }

    encrypt(data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
        return Promise.resolve().then(() => {
            const cipher = nodeCrypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(this.key),
                Buffer.from(iv)
            );
            const block = cipher.update(Buffer.from(data));
            return arrayToBuffer(Buffer.concat([block, cipher.final()]));
        });
    }

    decrypt(data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
        return Promise.resolve()
            .then(() => {
                const cipher = nodeCrypto.createDecipheriv(
                    'aes-256-cbc',
                    Buffer.from(this.key),
                    Buffer.from(iv)
                );
                const block = cipher.update(Buffer.from(data));
                return arrayToBuffer(Buffer.concat([block, cipher.final()]));
            })
            .catch(() => {
                throw new KdbxError(ErrorCodes.InvalidKey, 'invalid key');
            });
    }
}

export function createAesCbc(): AesCbc {
    return new AesCbcNode();
}

export function random(len: number): Uint8Array {
    return new Uint8Array(nodeCrypto.randomBytes(len));

}

export function chacha20(
    data: ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer
): Promise<ArrayBuffer> {
    return Promise.resolve().then(() => {
        const algo = new ChaCha20(new Uint8Array(key), new Uint8Array(iv));
        return arrayToBuffer(algo.encrypt(new Uint8Array(data)));
    });
}

export const Argon2TypeArgon2d = 0;
export const Argon2TypeArgon2id = 2;

export type Argon2Type = typeof Argon2TypeArgon2d | typeof Argon2TypeArgon2id;
export type Argon2Version = 0x10 | 0x13;

export type Argon2Fn = (
    password: ArrayBuffer,
    salt: ArrayBuffer,
    memory: number,
    iterations: number,
    length: number,
    parallelism: number,
    type: Argon2Type,
    version: Argon2Version
) => Promise<ArrayBuffer>;

let argon2impl: Argon2Fn | undefined;

export function argon2(
    password: ArrayBuffer,
    salt: ArrayBuffer,
    memory: number,
    iterations: number,
    length: number,
    parallelism: number,
    type: Argon2Type,
    version: Argon2Version
): Promise<ArrayBuffer> {
    if (argon2impl) {
        return argon2impl(
            password,
            salt,
            memory,
            iterations,
            length,
            parallelism,
            type,
            version
        ).then(arrayToBuffer);
    }
    return Promise.reject(new KdbxError(ErrorCodes.NotImplemented, 'argon2 not implemented'));
}

export function setArgon2Impl(impl: Argon2Fn): void {
    argon2impl = impl;
}
