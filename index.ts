import assert from "node:assert";

type Method = string;
type Path = string;
type Handler = (() => unknown) | ((params: ParsedParams) => unknown);
type PathFragment = string;
type Tree = Record<PathFragment, Node>;
type TreeByMethod = Record<Method, Tree>;
type Param = string;
type FoundParam = { startIndex: number, endIndex: number };
type FoundParams = Record<Param, FoundParam>;
type FoundParamsByStartIndex = Record<number, { param: Param, endIndex: number }>;
type FoundParamWithName = FoundParam & { param: string };
type ParsedParams = Record<string, string>;

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
    #traverseForHandler(method: Method, path: Path): { handler: Handler | undefined; parsedParams: ParsedParams  } {
        let node: Node;
        let parsedParams: ParsedParams = {};
        let tree = this.#treeByMethod[method];
        if (!tree) {
            return undefined;
        }
        let i = 1
        while (i <= path.length) {
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
                    parsedParams[node.param.param] = paramValue;
                    // remove parameter from path
                    path = path.slice(0, i + 1) + path.slice(paramValueEndIndex, path.length);
                }
            }
            i++;
        }
        if (node instanceof Leaf) {
            return { handler: node.handler, parsedParams  };
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
        assert(!path.endsWith(':'),  "path can't end with :");
    }
    #validateHandler(handler: Handler) {
        assert.equal(typeof handler, "function", "handler must be a function");
    }
    #buildTree(method: Method, path: Path, handler: Handler) {
        // TODO: this is now `trie`, not `radix tree` - to improve
        let tree = this.#getRootNode(method);
        let { foundParams, foundParamsByStartIndex } = this.#handleParams(path);
        let node: Node;
        let i = 1
        while (i <= path.length) {
            if (foundParamsByStartIndex[i]) {
                node.param = { ...foundParams[foundParamsByStartIndex[i].param], param: foundParamsByStartIndex[i].param }
                // remove parameter from path 
                path = path.slice(0, i) + path.slice(foundParamsByStartIndex[i].endIndex, path.length);
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
    #handleParams(path: Path): { foundParams: FoundParams, foundParamsByStartIndex: FoundParamsByStartIndex } {
        const foundParams: FoundParams = {};
        const foundParamsByStartIndex: FoundParamsByStartIndex = {};
        let nextParamEndIndex = 0;
        let nextParamStartIndex;
        while(0 < (nextParamStartIndex = path.indexOf(':', nextParamEndIndex))) {
            nextParamEndIndex = path.indexOf('/', nextParamStartIndex);
            if (nextParamEndIndex === -1) {
                nextParamEndIndex = path.indexOf('?', nextParamStartIndex);
            }
            if (nextParamEndIndex === -1) {
                nextParamEndIndex = path.length;
            }
            // +1 to strip out ":"
            const paramName = path.slice(nextParamStartIndex + 1, nextParamEndIndex);
            foundParams[paramName] = {
                startIndex: nextParamStartIndex,
                endIndex: nextParamEndIndex
            };
            foundParamsByStartIndex[nextParamStartIndex] = {
                param: paramName,
                endIndex: nextParamEndIndex
            };
        }
        return { foundParams, foundParamsByStartIndex };
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
    param: FoundParamWithName;
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
