/** @module Renders Mermaid source to monochrome SVG through compiler modules supplied by the host. */
import * as Wasm from './internal/Wasm.js';
/** Thrown when source cannot be rendered. Messages match Mermaid's diagnostics. */
export class RenderError extends Error {
    name = 'Render.RenderError';
    /** The kind of failure. */
    code;
    /** One-based UTF-16 column, or 0 when the error has no position. */
    column;
    /** One-based line, or 0 when the error has no position. */
    line;
    /** The offending source line with a caret under the column, or empty. */
    snippet;
    /** The detected diagram type, when known. */
    type;
    constructor(options) {
        super(options.message);
        this.code = options.code;
        this.column = options.column;
        this.line = options.line;
        this.snippet = options.snippet;
        this.type = options.type;
    }
}
/**
 * Creates a renderer from caller-supplied diagram modules.
 *
 * Each module holds one diagram type, or `all` of them. Modules may be precompiled by the host's
 * bundler, as Cloudflare Workers require, or given as base64 bytes.
 *
 * @example
 * ```ts
 * import { create } from 'ondine/compiler/wasm'
 * import { wasm as all } from 'ondine/compiler/wasm/all'
 *
 * const { svg } = create({ modules: { all } }).render('flowchart LR\n  A --> B')
 * ```
 */
export function create(options) {
    const instances = new Map();
    const instance = (type) => {
        let found = instances.get(type);
        if (found)
            return found;
        const module = options.modules[type];
        if (module === undefined)
            return undefined;
        found = Wasm.instantiate(module);
        instances.set(type, found);
        return found;
    };
    const types = Object.keys(options.modules);
    return {
        render(source, renderOptions = {}) {
            const first = types[0] === undefined ? undefined : instance(types[0]);
            if (first === undefined)
                throw new Error('Render.create needs at least one module.');
            const json = serialize(renderOptions);
            // The compiler reads no clock. Like JSON, it reads a time that is not a number as none.
            const time = renderOptions.now ?? Date.now();
            const now = typeof time === 'number' ? time : Number.NaN;
            const result = first.render(source, json, now);
            // A module reports the detected type when it does not include it.
            if (!result.ok && result.code === 'unsupported-diagram' && result.type !== undefined) {
                const owner = instance(result.type);
                if (owner)
                    return unwrap(owner.render(source, json, now));
            }
            return unwrap(result);
        },
    };
}
/** Options as the compiler reads them, without the time, which is passed apart. Empty for none. */
function serialize(options) {
    for (const _ in options)
        return JSON.stringify({ ...options, now: undefined });
    return '';
}
function unwrap(result) {
    if (!result.ok)
        throw new RenderError({ ...result, code: result.code });
    return {
        height: result.height,
        links: result.links,
        svg: result.svg,
        type: result.type,
        width: result.width,
    };
}
