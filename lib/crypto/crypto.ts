
// @ts-nocheck
import cipher from 'browserify-aes';
import createHash from 'create-hash';
import createHmac from 'create-hmac';

export const createCipheriv = cipher.createCipheriv;
export const createDecipheriv = cipher.createDecipheriv;

export { createHash, createHmac };
