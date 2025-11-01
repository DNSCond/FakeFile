"use strict"; // FakeFilesUI
var _a;
export class FakeFileUIElement extends HTMLElement {
}
/*
about types:

the default type is string, so it can be omitted.

write a string like "key1=type1,key2=type2,key3=type3", case-insensitive,
whitespace ignored "key1 = type1, key2 = type2, key3 = type3".

keys must be entered without the "headerset-*" prefix

- isodatetime: write a isoString, formatted like Date.prototype.toISOString (or whatever you put in if its invalid)
- date: write a isoString, formatted like Date.prototype.toUTCString
- time: write a isoString, formatted like Date.prototype.toTimeString
- bytes: write a number representing bytes, then it formats for humans

*/
export class FakeFileFile extends FakeFileUIElement {
    #observer;
    #abortController;
    #headerval = new Map;
    static get observedAttributes() {
        return ['ff-name', 'lastmod', 'open', 'bytesize', 'headerval'];
    }
    constructor() {
        super();
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerText = 'FakeFileFile';
        summary.className = 'summery';
        const head = document.createElement('dl');
        head.className = 'metadata';
        head.style.margin = '1em 0 1em 0';
        const div = document.createElement('div');
        div.className = 'content';
        div.append(Object.assign(document.createElement('slot'), { innerHTML: '<span style=font-style:italic>empty file</span>' }));
        details.append(summary, head, div);
        this.attachShadow({ mode: 'open' }).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {
                border: solid black 2px;
                border-right: none;
                padding: 0.5em;
            }.content {
                border-left: solid black 2px;
                padding-left: 1ch;
            } dt, dd {
                display: inline;
                margin: 0;
            } dt:after {
                content: ": ";
            }`.replaceAll(/\s+/g, ' '),
        }), details);
    }
    connectedCallback() {
        this.#abortController?.abort();
        const { signal } = (this.#abortController = new AbortController);
        const metadata = this.shadowRoot?.querySelector('.metadata');
        this.#observer = new MutationObserver(change => this.#attributeChangedCallback(change));
        this.#observer.observe(this, { attributes: true, attributeOldValue: true });
        this.shadowRoot.querySelector('details').addEventListener(
        // @ts-ignore
        'toggle', (event) => {
            this.open = (event.newState === 'open');
        }, { signal });
        if (metadata) {
            metadata.replaceChildren();
            this.updateHeaders();
        }
    }
    updateHeaders() {
        const changes = [];
        for (const attribute of this.attributes) {
            const changeName = attribute.name.toLowerCase();
            let oldValue = undefined, newValue = attribute.value;
            const constructor = this.constructor;
            if (changeName.startsWith('headerset-')) {
                changes.push({ changeName, oldValue, newValue });
            }
            if (constructor.observedAttributes.includes(changeName)) {
                if (changeName.startsWith('ff-'))
                    continue;
                switch (changeName) {
                    case "lastmod": {
                        const changeName = "last-modified";
                        newValue = (new Date(newValue)).toISOString();
                        changes.push({ changeName, oldValue, newValue });
                        break;
                    }
                    case "bytesize": {
                        const changeName = "content-length";
                        changes.push({ changeName, oldValue, newValue });
                        break;
                    }
                }
            }
        }
        this.#recreateMetaData(changes);
    }
    #attributeChangedCallback(mutationRecords) {
        const changes = [];
        for (const mutationRecord of mutationRecords) {
            const changeName = mutationRecord.attributeName;
            if (changeName?.toLowerCase().startsWith('headerset-')) {
                const oldValue = mutationRecord.oldValue;
                const newValue = this.getAttribute(changeName);
                changes.push({ changeName, oldValue, newValue });
            }
        }
        this.#recreateMetaData(changes);
    }
    disconnectedCallback() {
        this.#abortController?.abort();
        this.#observer?.disconnect();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (this.shadowRoot) {
            switch (name) {
                case 'ff-name': {
                    const summery = this.shadowRoot.querySelector('summary');
                    if (summery)
                        summery.innerText = `File: "${newValue || this.tagName}"`;
                    break;
                }
                case 'lastmod': {
                    if (newValue !== null) {
                        newValue = (new Date(newValue)).toUTCString();
                        this.#recreateMetaData([{ changeName: 'last-modified', oldValue, newValue }]);
                    }
                    break;
                }
                case 'headerval': {
                    const temp = this.#headerval = new Map;
                    if (newValue !== null) {
                        newValue = newValue.replaceAll(/\s+/g, '');
                        const types = newValue.toLowerCase().split(/,/g)
                            .map(m => m.split(/=/g))
                            .map(([key, val]) => ({ key, val }));
                        for (const { key, val } of types) {
                            temp.set(key, val);
                        }
                    }
                    break;
                }
                case "open": {
                    const details = this.shadowRoot.querySelector('details');
                    if (details) {
                        if (details.open !== (newValue !== null)) {
                            details.open = newValue !== null;
                        }
                    }
                    break;
                }
            }
        }
    }
    #recreateMetaData(changes) {
        if (this.shadowRoot) {
            const metadata = this.shadowRoot.querySelector('.metadata');
            if (!metadata)
                throw new TypeError('metadata is null');
            const elements = {}, missing = [], changeNames = changes.map(m => m.changeName);
            for (const child of metadata.children) {
                const keyName = child.dataset?.keyName;
                if (keyName !== undefined) {
                    if (changeNames.includes(keyName)) {
                        elements[keyName] = child;
                    }
                    else {
                        missing.push(keyName);
                    }
                }
            }
            for (const changeName of changeNames) {
                if (!(changeName in elements) && !missing.includes(changeName)) {
                    missing.push(changeName);
                }
            }
            for (const string of missing) {
                const keyElement = this.ownerDocument.createElement('dt');
                const valElement = this.ownerDocument.createElement('dd');
                const div = this.ownerDocument.createElement('div');
                div.append(keyElement, valElement);
                div.dataset.keyName = string;
                elements[string] = div;
            }
            const changesToMake = [];
            for (const change of changes) {
                if (elements[change.changeName]) {
                    // const {keyElement, valElement} = elements[change.changeName];
                    const keyElement = elements[change.changeName].querySelector('dt') ?? undefined;
                    const valElement = elements[change.changeName].querySelector('dd') ?? undefined;
                    if (change.newValue === null) {
                        elements[change.changeName]?.remove();
                    }
                    if (keyElement === undefined || valElement === undefined) {
                        throw new TypeError('InternalError');
                    }
                    if (change.newValue) {
                        valElement.innerText = this.#normalizeValueString(change.changeName, change.newValue);
                        keyElement.innerText = uppercaseAfterHyphen(change.changeName);
                        changesToMake.push(elements[change.changeName]);
                    }
                }
            }
            metadata.append(...changesToMake);
        }
    }
    #normalizeValueString(name, value) {
        switch (name) {
            case "content-length":
                return cbyte(+value);
            case "last-modified":
                return (new Date(value)).toUTCString();
        }
        const type = this.#headerval.get(name.toLowerCase().replace(/^headerset-/i, ''));
        switch (type) {
            case "date": {
                const timeValue = new Date(value);
                return timeValue.toUTCString();
            }
            case "time": {
                const timeValue = new Date(value);
                return timeValue.toTimeString();
            }
            case "isodatetime": {
                const timeValue = new Date(value);
                if (isValidDate(timeValue)) {
                    return timeValue.toISOString();
                }
                else
                    return value;
            }
            case "bytes":
                return cbyte(+value);
            default:
                return value;
        }
    }
    set bytesize(value) {
        if (value === null) {
            this.removeAttribute('bytesize');
        }
        else {
            if (Number.isSafeInteger(value)) {
                this.setAttribute('bytesize', String(value));
            }
            else
                throw RangeError(`${value} is not a valid bytesize=""`);
        }
    }
    get bytesize() {
        return this.getAttribute('ff-name');
    }
    set fileName(value) {
        if (value === null)
            this.removeAttribute('ff-name');
        else
            this.setAttribute('ff-name', value);
    }
    get fileName() {
        return this.getAttribute('ff-name');
    }
    set open(value) {
        if (value || value === '') {
            this.setAttribute('open', value === true ? '' : value);
        }
        else {
            this.removeAttribute('open');
        }
    }
    get open() {
        return this.getAttribute('open');
    }
    set lastMod(value) {
        if (value === null) {
            this.removeAttribute('lastmod');
        }
        else {
            const isoString = (new Date(value)).toISOString();
            this.setAttribute('lastmod', isoString);
        }
    }
    get lastMod() {
        const dt = this.getAttribute('lastmod');
        if (dt == null)
            return null;
        return new Date(dt);
    }
    setHeader(name, value) {
        name = `headerset-${name}`;
        if (value === null) {
            this.removeAttribute(name);
            return this;
        }
        if (value instanceof Date) {
            value = value.toUTCString();
        }
        this.setAttribute(name, `${value}`);
        return this;
    }
    getHeader(name) {
        return this.getAttribute(name);
    }
    setHeaders(keyValues) {
        for (const [key, value] of (Object.entries(keyValues))) {
            this.setHeader(camelToKebab(key), value);
        }
        return this;
    }
    getAllHeaders() {
        const constructor = this.constructor, result = new Map;
        for (const attribute of this.attributes) {
            const { name, value } = attribute;
            if ((name.startsWith('headerset-')) || (constructor.observedAttributes.includes(name))) {
                result.set(name, value);
            }
        }
        return result;
    }
}
export class FakeFileDirectory extends FakeFileUIElement {
    #registered = [];
    #abortController;
    #observer;
    static get observedAttributes() {
        return ['ff-name', 'isexpanded'];
    }
    constructor() {
        super();
        const list = document.createElement('ul');
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerText = 'FakeFileDirectory';
        summary.className = 'summery';
        details.append(summary, list);
        this.attachShadow({ mode: 'open' }).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {
                border: solid black 2px;
                border-right: none;
                padding: 0.5em;
            }li{margin-top:0.5em;
            margin-bottom:0.5em;}
            ul{margin-bottom:0;
            list-style-type:none;
            padding-left: 1ch;
            }`.replaceAll(/\s+/g, ' '),
        }), details);
    }
    connectedCallback() {
        this.#updateRegistered();
        // watch for child changes
        this.#observer = new MutationObserver(() => this.#updateRegistered());
        const { signal } = (this.#abortController = new AbortController);
        this.#observer.observe(this, { childList: true });
        this.#updateRegistered();
        this.shadowRoot.querySelector('details').addEventListener(
        // @ts-ignore
        'toggle', (event) => {
            this.isexpanded = (event.newState === 'open');
        }, { signal });
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        if (this.shadowRoot) {
            switch (name) {
                case 'ff-name': {
                    const summery = this.shadowRoot.querySelector('summary');
                    if (summery)
                        summery.innerText = `Directory: "${newValue || this.tagName}"`;
                    break;
                }
                case "isexpanded": {
                    const details = this.shadowRoot.querySelector('details');
                    if (details) {
                        if (details.open !== (newValue !== null)) {
                            details.open = newValue !== null;
                        }
                    }
                    break;
                }
            }
        }
    }
    disconnectedCallback() {
        this.#abortController?.abort();
        this.#observer?.disconnect();
    }
    /**
     * Returns an up-to-date array of immediate child FakeFiles and Directories.
     */
    get childrenEntries() {
        return [...this.#registered];
    }
    #updateRegistered() {
        // only *direct* children (not nested descendants)
        // this.#registered = Array.from(this.children)
        // .filter((el): el is FakeFileFile | FakeFileDirectory =>
        // el instanceof FakeFileFile || el instanceof FakeFileDirectory);
        const children = (this.#registered = Array.from(this.children, child => {
            if (child instanceof FakeFileFile || child instanceof _a) {
                return child;
            }
            else {
                child.removeAttribute('slot');
                return null;
            }
        }).filter(m => m !== null));
        children.forEach(function (each, index) {
            const slotname = `FakeFile-${index++}`;
            each.setAttribute('slot', slotname);
        });
        this.#updateSlottedItems();
    }
    #updateSlottedItems() {
        if (this.shadowRoot) {
            const children = this.childrenEntries.map(child => {
                const listitem = this.ownerDocument.createElement('li'), slot = this.ownerDocument.createElement('slot');
                slot.style.display = 'block';
                slot.name = child.slot;
                listitem.append(slot);
                return listitem;
            });
            this.shadowRoot.querySelector('ul').replaceChildren(...children);
        }
    }
    set fileName(value) {
        if (value === null)
            this.removeAttribute('ff-name');
        else
            this.setAttribute('ff-name', value);
    }
    get fileName() {
        return this.getAttribute('ff-name');
    }
    set isexpanded(value) {
        if (value || value === '') {
            this.setAttribute('isexpanded', value === true ? '' : value);
        }
        else {
            this.removeAttribute('isexpanded');
        }
    }
    get isexpanded() {
        return this.getAttribute('isexpanded');
    }
    get lastModified() {
        const dates = Array.from(this.children, m => m.getAttribute('lastmod'));
        return findLatestDate(dates.map(m => m ? new Date(m) : null));
    }
}
_a = FakeFileDirectory;
customElements.define('ff-f', FakeFileFile);
customElements.define('ff-d', FakeFileDirectory);
export function cbyte(bytesize) {
    const units = Array("bytes", "KB", "MB", "GB", "TB");
    let i = 0;
    bytesize = +bytesize;
    if (!Number.isFinite(bytesize))
        throw new TypeError('bytesize resulted into a non finite number');
    while (bytesize >= 1024) {
        bytesize = bytesize / 1024;
        if (units[++i] === undefined) {
            i--;
            break;
        }
    }
    return `${bytesize.toFixed(2).replace(/\.?0*$/, '')} ${units[i]}`;
}
export function joinArray(array, seperator, replacer, isCallback = false) {
    const a = Array.from(array, replacer ?? (m => m)), result = [];
    let index = 0;
    for (const t of a) {
        if (isCallback) {
            result.push(t, Function.prototype.apply.call(seperator, result, [index++, a]));
        }
        else {
            result.push(t, seperator);
        }
    }
    if (result.length > 2)
        result.length = result.length - 1;
    return result;
}
export const isValidDate = function (date) {
    return !isNaN(date);
};
export function findLatestDate(array, toDate = m => m) {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.max(...dates.filter(m => m !== null).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate))
        return asDate;
    else
        return null;
}
export function findFirstDate(array, toDate = m => m) {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.min(...dates.filter(m => m !== null).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate))
        return asDate;
    else
        return null;
}
export function uppercaseAfterHyphen(str) {
    return String(str).split('').map((char, i, arr) => {
        if (i === 0 || arr[i - 1] === '-') {
            return char.toUpperCase();
        }
        return char;
    }).join('');
}
export function kebabToCamel(str) {
    return String(str).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
export function camelToKebab(str) {
    return String(str)
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase();
}
