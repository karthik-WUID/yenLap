import { randomInt } from 'node:crypto';
export interface OTPProvider {
    send(phone: string, code: string): Promise<void>;
}
export interface MessagingProvider {
    send(channel: string, recipient: string, message: string, idempotencyKey: string): Promise<void>;
}
export interface ObjectStorage {
    put(key: string, bytes: Buffer): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
}
export const otpProvider: OTPProvider = { async send(phone, code) {
        if (process.env.NODE_ENV === 'production')
            throw Error('Production OTP adapter must be configured');
        console.log('LOCAL OTP', phone, code);
    } };
export const messagingProvider: MessagingProvider = { async send(channel, recipient, message, key) {
        if (process.env.NODE_ENV === 'production' && channel !== 'in_app')
            throw Error('Production messaging adapter must be configured');
        console.log('MOCK DELIVERY', channel, recipient, key, message);
    } };
export const generateOTP = () => String(randomInt(100000, 1000000));
