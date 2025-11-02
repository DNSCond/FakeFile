// promise-with-resolvers.d.ts
export {};

declare global {
    interface PromiseConstructor {
        /**
         * Creates a Promise along with its resolve/reject functions
         */
        withResolvers<T = any>(): {
            promise: Promise<T>;
            resolve: (value: T | PromiseLike<T>) => void;
            reject: (reason?: any) => void;
        };
    }
}