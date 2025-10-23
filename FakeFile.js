"use strict"; // FakeFilesUI
var _a;
export class FakeFileUIElement extends HTMLElement {
}
export class FakeFileFile extends FakeFileUIElement {
    #observer = new MutationObserver(change => this.#attributeChangedCallback(change));
    #abortController;
    static get observedAttributes() {
        return ['ff-name', 'lastmod']; //, 'bytesize'
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
        details.open = true;
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
        this.#observer.observe(this, { attributes: true, attributeOldValue: true });
    }
    connectedCallback() {
        this.#abortController?.abort();
        (this.#abortController = new AbortController);
        const metadata = this.shadowRoot?.querySelector('.metadata');
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
                        newValue = (new Date(newValue)).toUTCString();
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
        console.log(changes);
        this.#recreateMetaData(changes);
    }
    disconnectedCallback() {
        this.#abortController?.abort();
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
                        valElement.innerText = change.newValue;
                        keyElement.innerText = uppercaseAfterHyphen(change.changeName);
                        changesToMake.push(elements[change.changeName]);
                    }
                }
            }
            metadata.append(...changesToMake);
        }
    }
    /*#recreateMetaData(changes: changes[]): void {
        if (this.shadowRoot) {
            const metadata = this.shadowRoot.querySelector('.metadata');
            if (!metadata) throw new TypeError('metadata is null');
            const elements: { [key: string]: { keyElement?: HTMLElement, valElement?: HTMLElement } } = {},
                missing: string[] = [], missingV: string[] = [],
                changeNames = changes.map(m => m.changeName);
            for (const child of metadata.children) {
                const keyName = (child as HTMLElement).dataset?.keyName;
                if (keyName !== undefined) {
                    elements[keyName as string] ??= {};
                    if (changeNames.includes(keyName)) {
                        elements[keyName as string].keyElement = (child as HTMLElement);
                    } else {
                        missing.push(keyName as string);
                    }
                }
                const valName = (child as HTMLElement).dataset?.valName;
                if (valName !== undefined) {
                    elements[valName as string] ??= {};
                    if (changeNames.includes(valName)) {
                        elements[valName as string].valElement = (child as HTMLElement);
                    } else {
                        missingV.push(valName as string);
                    }
                }
            }
            for (const changeName of changeNames) {
                if (!(changeName in elements) && !missing.includes(changeName) && !missingV.includes(changeName)) {
                    missing?.push(changeName);
                    missingV.push(changeName);
                }
            }
            for (const string of (new Set(missing.concat(missingV))).values()) {
                const obj = elements[string] ??= {};
                const keyElement = this.ownerDocument.createElement('dt');
                const valElement = this.ownerDocument.createElement('dd');
                obj.keyElement ??= keyElement;
                obj.valElement ??= valElement;
                // if (elements[string]) {
                //     const keyElement = this.ownerDocument.createElement('dt');
                //     elements[string] = {keyElement};
                // }
                // if (!elements[string]) {
                //     const valElement = this.ownerDocument.createElement('dd');
                //     elements[string] = {valElement};
                // }
            }
            const changesToMake: HTMLElement[] = [];
            for (const change of changes) {
                if (elements[change.changeName]) {
                    const {keyElement, valElement} = elements[change.changeName];
                    if (change.newValue === null) {
                        keyElement?.remove();
                        valElement?.remove();
                    }
                    if (keyElement === undefined || valElement === undefined) throw new TypeError('InternalError');
                    if (change.newValue) {
                        valElement.innerText = change.newValue;
                        keyElement.innerText = change.changeName;
                        changesToMake.push(keyElement, valElement);
                    }
                }
            }
            metadata.append(...changesToMake);
        }
    }*/
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
            return;
        }
        if (typeof value === 'object' || typeof value === 'function') {
            if ('toUTCString' in value) {
                value = value.toUTCString();
            }
        }
        this.setAttribute(name, `${value}`);
        return this;
    }
    getHeader(name) {
        return this.getAttribute(name);
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
            ul{margin-bottom:0;}`.replaceAll(/\s+/g, ' ')
        }), details);
    }
    connectedCallback() {
        this.#updateRegistered();
        // watch for child changes
        this.#observer = new MutationObserver(() => this.#updateRegistered());
        this.#observer.observe(this, { childList: true });
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
                    if (details)
                        details.open = newValue !== null;
                    break;
                }
            }
        }
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
    disconnectedCallback() {
        this.#observer?.disconnect();
    }
    get lastModified() {
        const dates = Array.from(this.children, m => m.getAttribute('lastmod')).map(m => m ? new Date(m) : null);
        return findLatestDate(dates);
    }
}
_a = FakeFileDirectory;
customElements.define('ff-f', FakeFileFile);
customElements.define('ff-d', FakeFileDirectory);
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
export function uppercaseAfterHyphen(str) {
    return String(str).split('').map((char, i, arr) => {
        if (i === 0 || arr[i - 1] === '-') {
            return char.toUpperCase();
        }
        return char;
    }).join('');
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
