import assert from "node:assert";

type Method = string;
type Path = string;
type Handler = Function;
type PathFragment = string;
type Tree = Record<PathFragment, Node>;
type TreeByMethod = Record<Method, Tree>;
export class RadixRouter {
    #treeByMethod: TreeByMethod = {};
    #notFondHandler: Handler;
    constructor(notFoundCb?: Handler) {
        this.#notFondHandler = notFoundCb ?? noopFn;
    }
    get(path: Path, handler: Handler) {
        this.#register('GET', path, handler);
    }
    lookup(method: Method, path: Path) {
        const clearedPath = this.#clearPath(path);
        const handler: Handler = this.#traverseForHandler(method, clearedPath) ?? this.#notFondHandler;
        handler();
    }
    #clearPath(path: Path): Path {
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, path.length - 1);
        }
        return path;
    }
    #traverseForHandler(method: Method, path: Path): Handler | undefined {
        let node: Node;
        let tree = this.#treeByMethod[method];
        if (!tree) {
            return undefined;
        }
        for (let i = 1; i <= path.length; i++) {
            const pathFragment: PathFragment = path.slice(0, i);
            node = tree[pathFragment];
            if (!node) {
                // node do not exists aka. dead end
                break;
            }
            tree = node.childTree;
            if (!tree) {
                // node do not have children's aka. dead end
                break;
            }
        }
        if (node instanceof Leaf) {
            return node.handler;
        }
        // node was node found or is not a Leaf
        return undefined;
    }
    #register(method: Method, path: Path, handler: Handler) {
        this.#validatePath(path);
        this.#validateHandler(handler);
        this.#buildTree(method, path, handler);
    }
    #validatePath(path: Path) {
        assert.equal(typeof path, "string", "path must be a string");
        assert(path.startsWith('/'),  "path must start with /");
        path.length > 1 && assert(!path.endsWith('/'),  "path can't end with /");
    }
    #validateHandler(handler: Handler) {
        assert.equal(typeof handler, "function", "handler must be a function");
    }
    #buildTree(method: Method, path: Path, handler: Handler) {
        // TODO: this is now `trie`, not `radix tree` - to improve
        let tree = this.#getRootNode(method);
        let node: Node;
        for (let i = 1; i <= path.length; i++) {
            const pathFragment: PathFragment = path.slice(0, i);
            node = tree[pathFragment];
            if (!node) {
                const isLeaf = i === path.length;
                node = isLeaf ? new Leaf(pathFragment, handler) : new Node(pathFragment);
                tree[pathFragment] = node;
            }
            tree = node.childTree;
        }
    }
    #getRootNode(method: Method): Tree {
        this.#createRootIfNotExists(method);
        return this.#treeByMethod[method];
    }
    #createRootIfNotExists(method: Method) {
        if (!this.#treeByMethod[method]) {
            this.#treeByMethod[method] = {};
        }
    }
}

class Node {
    #pathFragment: PathFragment;
    childTree: Tree = {};
    constructor(pathFragment: PathFragment) { 
        this.#pathFragment = pathFragment;
    }
}

class Leaf extends Node {
    handler: Handler;
    constructor(pathFragment: PathFragment, handler: Handler) {
        super(pathFragment);
        this.handler = handler;
    }
}

const noopFn = () => {};
