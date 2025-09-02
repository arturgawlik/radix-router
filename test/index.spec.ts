import { test } from "node:test";
import assert from "node:assert"
import { RadixRouter } from "../index.ts";

test('should create instance of router', () => {
    const router = new RadixRouter();
    assert(router, 'router instance do not exists');
});

test('should allow to define path with handler', () => {
    const router = new RadixRouter();
    router.get('/', () => console.log('hello from / handler'));
});

test('should throw if path is not a string', () => {
    const router = new RadixRouter();
    assert.throws(() => {
        router.get(123 as any, () => console.log('hello from / handler'));
    }, /path must be a string/);
});

test('should throw if handler is not a function', () => {
    const router = new RadixRouter();
    assert.throws(() => {
        router.get('/', 123 as any);
    }, /handler must be a function/);
});

test('should throw if path is not starting with /', () => {
    const router = new RadixRouter();
    assert.throws(() => {
        router.get('some/path', () => console.log('hello from / handler'));
    }, /path must start with \//);
});

test('should allow calling lookup', () => {
    const router = new RadixRouter();
    router.get('/', () => console.log('hello from / handler'));
    router.lookup('GET', '/');
});

test('should call handler for GET "/" when lookup for GET "/" is called and there is no other handlers', (t) => {
    const router = new RadixRouter();
    const mockHandler = t.mock.fn();
    router.get('/', mockHandler);
    router.lookup('GET', '/');
    assert.equal(mockHandler.mock.callCount(), 1);
});

test('should call handler for right path when there is registered multiple handlers', (t) => {
    const router = new RadixRouter();
    const mockHandlerBase = t.mock.fn();
    const mockHandlerA = t.mock.fn();
    const mockHandlerB = t.mock.fn();
    router.get('/', mockHandlerBase);
    router.get('/A', mockHandlerA);
    router.get('/B', mockHandlerB);
    router.lookup('GET', '/A');
    assert.equal(mockHandlerBase.mock.callCount(), 0);
    assert.equal(mockHandlerA.mock.callCount(), 1);
    assert.equal(mockHandlerB.mock.callCount(), 0);
});

test('should call handler for right path when there is registered multiple handlers without / handler', (t) => {
    const router = new RadixRouter();
    const mockHandlerA = t.mock.fn();
    const mockHandlerB = t.mock.fn();
    const mockHandlerC = t.mock.fn();
    router.get('/A', mockHandlerA);
    router.get('/B', mockHandlerB);
    router.get('/C', mockHandlerC);
    router.lookup('GET', '/A');
    assert.equal(mockHandlerA.mock.callCount(), 1);
    assert.equal(mockHandlerB.mock.callCount(), 0);
    assert.equal(mockHandlerC.mock.callCount(), 0);
});

test('should call handler for right nested path when there is registered multiple handlers', (t) => {
    const router = new RadixRouter();
    const mockHandlerA1 = t.mock.fn();
    const mockHandlerB1 = t.mock.fn();
    const mockHandlerC1 = t.mock.fn();
    router.get('/A/1', mockHandlerA1);
    router.get('/B/1', mockHandlerB1);
    router.get('/C/1', mockHandlerC1);
    router.lookup('GET', '/A/1');
    assert.equal(mockHandlerA1.mock.callCount(), 1);
    assert.equal(mockHandlerB1.mock.callCount(), 0);
    assert.equal(mockHandlerC1.mock.callCount(), 0);
});

test('should not call provided handler when there is no path found', (t) => {
    const router = new RadixRouter();
    const mockHandlerA1 = t.mock.fn();
    router.get('/A/1', mockHandlerA1);
    router.lookup('GET', '/some/no/existing/path');
    assert.equal(mockHandlerA1.mock.callCount(), 0)
});

test('should not throw when there is no path found and there is no 404 handler provided with no any handlers registered', (t) => {
    const router = new RadixRouter();
    router.lookup('GET', '/some/no/existing/path');
});

test('should call 404 handler when there is no path found', (t) => {
    const notFoundHandler = t.mock.fn();
    const router = new RadixRouter(notFoundHandler);
    router.get('/A/1', notFoundHandler);
    router.lookup('GET', '/some/no/existing/path');
    assert.equal(notFoundHandler.mock.callCount(), 1)
});

