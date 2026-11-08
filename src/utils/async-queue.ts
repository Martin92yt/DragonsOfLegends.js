/**
 * Serializes asynchronous operations: each one starts only after the previous one has settled.
 *
 * Used to make read-modify-write sequences atomic per player (item bank transfers, job actions).
 */
export default class AsyncQueue {
    private tail: Promise<void> = Promise.resolve();

    /**
     * Enqueues an operation.
     *
     * @param operation The asynchronous operation to run once the queue is free.
     * @returns A promise settled with the operation result; a failure never blocks the queue.
     */
    public run<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.tail.then(operation);
        this.tail = result.then(
            () => undefined,
            () => undefined
        );
        return result;
    }
}
