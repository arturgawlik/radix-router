import assert from "node:assert";

type Method = string;
type Path = string;
type Handler = (() => unknown) | ((params: ParsedParams) => unknown);
type PathFragment = string;
type TreeByMethod = Record<Method, Tree>;
type NodeByPathFragment = Record<PathFragment, Node>;
type ParsedParams = Record<string, string>;
type TraverseResult = {
    handler: Handler,
    parsedParams: ParsedParams
};

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
        const traversedResult = this.#traverseForHandler(method, clearedPath);
        const handler = traversedResult?.handler ?? this.#notFondHandler;
        handler(traversedResult?.parsedParams);
    }
    #clearPath(path: Path): Path {
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, path.length - 1);
        }
        return path;
    }
    #traverseForHandler(method: Method, path: Path): TraverseResult | undefined {
        let tree = this.#treeByMethod[method];
        if (tree) {
            return tree.traverse(path);
        }
    }
    #register(method: Method, path: Path, handler: Handler) {
        this.#validatePath(path);
        this.#validateHandler(handler);
        this.#buildTree(method, path, handler);
    }
    #buildTree(method: Method, path: Path, handler: Handler) {
        let tree = this.#treeByMethod[method];
        if (!tree) {
            tree = new Tree();
            this.#treeByMethod[method] = tree;
        }
        tree.build(path, handler);
    }
    #validatePath(path: Path) {
        assert.equal(typeof path, "string", "path must be a string");
        assert(path.startsWith('/'), "path must start with /");
        path.length > 1 && assert(!path.endsWith('/'), "path can't end with /");
        assert(!path.endsWith(':'), "path can't end with :");
    }
    #validateHandler(handler: Handler) {
        assert.equal(typeof handler, "function", "handler must be a function");
    }
}

class Tree {
    #nodeByPathFragment: NodeByPathFragment = {};
    constructor() {
    }
    build(path: Path, handler: Handler) {
        this.#buildTree(path, handler);
    }
    traverse(path: Path): TraverseResult | undefined {
        return this.#traverseForHandler(path);
    }
    #traverseForHandler(path: Path) {
        let node: Node;
        let parsedParams: ParsedParams = {};
        let nodeByPathFragment: NodeByPathFragment = this.#nodeByPathFragment;
        if (!nodeByPathFragment) {
            return undefined;
        }
        let i = 1
        while (i <= path.length) {
            const pathFragment: PathFragment = path.slice(0, i);
            node = nodeByPathFragment[pathFragment];
            if (!node) {
                // node do not exists aka. dead end
                break;
            }
            nodeByPathFragment = node.childTree;
            if (!nodeByPathFragment) {
                // node do not have children's aka. dead end
                break;
            }
            if (node instanceof Node) {
                if (node.param) {
                    const nextPosition = i + 1;
                    let paramValueEndIndex = path.indexOf('/', nextPosition);
                    if (paramValueEndIndex === -1) {
                        paramValueEndIndex = path.indexOf('?', nextPosition);
                    }
                    if (paramValueEndIndex === -1) {
                        paramValueEndIndex = path.length;
                    }
                    const paramValue = path.slice(nextPosition, paramValueEndIndex);
                    parsedParams[node.param.name] = paramValue;
                    // remove parameter from path
                    path = path.slice(0, i + 1) + path.slice(paramValueEndIndex, path.length);
                }
            }
            i++;
        }
        if (node instanceof Leaf) {
            return { handler: node.handler, parsedParams };
        }
        // node was node found or is not a Leaf
        return undefined;
    }
    #buildTree(path: Path, handler: Handler) {
        // TODO: this is now `trie`, not `radix tree` - to improve
        let tree = this.#nodeByPathFragment;
        let params = this.#createParams(path);
        let node: Node;
        let i = 1
        while (i <= path.length) {
            if (params.hasAtPathIndex(i)) {
                const param = params.getAtPathIndex(i);
                node.param = param;
                // remove parameter from path 
                path = path.slice(0, i) + path.slice(param.endIndex, path.length);
            }
            const pathFragment: PathFragment = path.slice(0, i);
            node = tree[pathFragment];
            if (!node) {
                const isLeaf = i === path.length;
                node = isLeaf ? new Leaf(pathFragment, handler) : new Node(pathFragment);
                tree[pathFragment] = node;
            }
            tree = node.childTree;
            i++;
        }
    }
    #createParams(path: Path): Params {
        const params = new Params(path);
        return params;
    }
}

class Params {
    #foundParams: Param[] = [];
    #path: Path;
    constructor(path: Path) {
        this.#path = path;
        this.#parseParams();
    }
    hasAtPathIndex(index: number): boolean {
        return Boolean(this.getAtPathIndex(index));
    }
    getAtPathIndex(index: number): Param {
        return this.#foundParams.find(({ startIndex }) => startIndex === index);
    }
    #parseParams() {
        let nextParamEndIndex = 0;
        let nextParamStartIndex;
        while (0 < (nextParamStartIndex = this.#path.indexOf(':', nextParamEndIndex))) {
            nextParamEndIndex = this.#path.indexOf('/', nextParamStartIndex);
            if (nextParamEndIndex === -1) {
                nextParamEndIndex = this.#path.indexOf('?', nextParamStartIndex);
            }
            if (nextParamEndIndex === -1) {
                nextParamEndIndex = this.#path.length;
            }
            // +1 to strip out ":"
            const paramName = this.#path.slice(nextParamStartIndex + 1, nextParamEndIndex);
            const param = new Param(paramName, nextParamStartIndex, nextParamEndIndex);
            this.#foundParams.push(param);
        }
    }
}

class Param {
    name;
    startIndex;
    endIndex;
    constructor(name: string, startIndex: number, endIndex: number) {
        this.name = name;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
    }
}

class Node {
    #pathFragment: PathFragment;
    childTree: NodeByPathFragment = {};
    param: Param;
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

const noopFn = () => { };
