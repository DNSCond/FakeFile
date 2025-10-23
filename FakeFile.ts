"use strict"; // FakeFilesUI
export abstract class FakeFileUIElement extends HTMLElement {
}

export type changes = { changeName: string, oldValue?: string | null | undefined, newValue: string | null };

export class FakeFileFile extends FakeFileUIElement {
    #observer: MutationObserver = new MutationObserver(change => this.#attributeChangedCallback(change));
    #abortController?: AbortController;

    static get observedAttributes(): string[] {
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
        div.append(Object.assign(document.createElement('slot'),
            {innerHTML: '<span style=font-style:italic>empty file</span>'}));
        details.append(summary, head, div);
        details.open = true;
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
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
        this.#observer.observe(this, {attributes: true, attributeOldValue: true});
    }


    connectedCallback(): void {
        this.#abortController?.abort();
        (this.#abortController = new AbortController);
        const metadata = this.shadowRoot?.querySelector('.metadata');
        if (metadata) {
            metadata.replaceChildren();
            this.updateHeaders();
        }
    }

    updateHeaders() {
        const changes: changes[] = [];
        for (const attribute of this.attributes) {
            const changeName = attribute.name.toLowerCase();
            let oldValue = undefined, newValue = attribute.value;
            const constructor = this.constructor as typeof FakeFileFile;
            if (changeName.startsWith('headerset-')) {
                changes.push({changeName, oldValue, newValue});
            }
            if (constructor.observedAttributes.includes(changeName)) {
                if (changeName.startsWith('ff-')) continue;
                switch (changeName) {
                    case "lastmod": {
                        const changeName = "last-modified";
                        newValue = (new Date(newValue)).toUTCString();
                        changes.push({changeName, oldValue, newValue});
                        break;
                    }
                    case "bytesize": {
                        const changeName = "content-length";
                        changes.push({changeName, oldValue, newValue});
                        break;
                    }
                }
            }
        }
        this.#recreateMetaData(changes);
    }

    #attributeChangedCallback(mutationRecords: MutationRecord[]): void {
        const changes: changes[] = [];
        for (const mutationRecord of mutationRecords) {
            const changeName = mutationRecord.attributeName;
            if (changeName?.toLowerCase().startsWith('headerset-')) {
                const oldValue: string | null = mutationRecord.oldValue;
                const newValue: string | null = this.getAttribute(changeName);
                changes.push({changeName, oldValue, newValue});
            }
        }
        console.log(changes);
        this.#recreateMetaData(changes);
    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (this.shadowRoot) {
            switch (name) {
                case 'ff-name': {
                    const summery = this.shadowRoot.querySelector('summary');
                    if (summery) summery.innerText = `File: "${newValue || this.tagName}"`;
                    break;
                }
                case 'lastmod': {
                    if (newValue !== null) {
                        newValue = (new Date(newValue)).toUTCString();
                        this.#recreateMetaData([{changeName: 'last-modified', oldValue, newValue}]);
                    }
                    break;
                }
            }
        }
    }

    #recreateMetaData(changes: changes[]): void {
        if (this.shadowRoot) {
            const metadata = this.shadowRoot.querySelector('.metadata');
            if (!metadata) throw new TypeError('metadata is null');
            const elements: { [key: string]: HTMLDivElement } = {},
                missing: string[] = [], changeNames = changes.map(m => m.changeName);
            for (const child of metadata.children) {
                const keyName = (child as HTMLDivElement).dataset?.keyName;
                if (keyName !== undefined) {
                    if (changeNames.includes(keyName)) {
                        elements[keyName as string] = (child as HTMLDivElement);
                    } else {
                        missing.push(keyName as string);
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
            const changesToMake: HTMLElement[] = [];
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

    set lastMod(value: Date | string | number | null) {
        if (value === null) {
            this.removeAttribute('lastmod');
        } else {
            const isoString = (new Date(value)).toISOString();
            this.setAttribute('lastmod', isoString);
        }
    }

    get lastMod(): Date | null {
        const dt = this.getAttribute('lastmod');
        if (dt == null) return null;
        return new Date(dt);
    }

    setHeader(name: string, value: string | number | boolean | Date | null) {
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

    getHeader(name: string): string | boolean | Date | null {
        return this.getAttribute(name);
    }

    getAllHeaders(): Map<string, string | boolean | Date> {
        const constructor = this.constructor as typeof FakeFileFile,
            result: Map<string, string | boolean | Date> = new Map;
        for (const attribute of this.attributes) {
            const {name, value} = attribute;
            if ((name.startsWith('headerset-')) || (constructor.observedAttributes.includes(name))) {
                result.set(name, value);
            }
        }
        return result;
    }
}

export class FakeFileDirectory extends FakeFileUIElement {
    #registered: (FakeFileFile | FakeFileDirectory)[] = [];
    #observer?: MutationObserver;

    static get observedAttributes(): string[] {
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
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
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
        this.#observer.observe(this, {childList: true});
    }

    /**
     * Returns an up-to-date array of immediate child FakeFiles and Directories.
     */
    get childrenEntries(): (FakeFileFile | FakeFileDirectory)[] {
        return [...this.#registered];
    }

    #updateRegistered() {
        // only *direct* children (not nested descendants)
        // this.#registered = Array.from(this.children)
        // .filter((el): el is FakeFileFile | FakeFileDirectory =>
        // el instanceof FakeFileFile || el instanceof FakeFileDirectory);
        const children = (this.#registered = Array.from(this.children, child => {
            if (child instanceof FakeFileFile || child instanceof FakeFileDirectory) {
                return child;
            } else {
                child.removeAttribute('slot');
                return null;
            }
        }).filter(m => m !== null) as (FakeFileFile | FakeFileDirectory)[]);
        children.forEach(function (
            each, index) {
            const slotname = `FakeFile-${index++}`;
            each.setAttribute('slot', slotname);
        });
        this.#updateSlottedItems();
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (this.shadowRoot) {
            switch (name) {
                case 'ff-name': {
                    const summery = this.shadowRoot.querySelector('summary');
                    if (summery) summery.innerText = `Directory: "${newValue || this.tagName}"`;
                    break;
                }
                case "isexpanded": {
                    const details = this.shadowRoot.querySelector('details');
                    if (details) details.open = newValue !== null;
                    break;
                }
            }
        }
    }

    #updateSlottedItems() {
        if (this.shadowRoot) {
            const children = this.childrenEntries.map(child => {
                const listitem = this.ownerDocument.createElement('li'),
                    slot = this.ownerDocument.createElement('slot');
                slot.style.display = 'block';
                slot.name = child.slot;
                listitem.append(slot);
                return listitem;
            });
            this.shadowRoot.querySelector('ul')!.replaceChildren(...children);
        }
    }

    disconnectedCallback() {
        this.#observer?.disconnect();
    }

    get lastModified(): Date | null {
        const dates: (Date | null)[] = Array.from(this.children, m => m.getAttribute('lastmod')).map(m => m ? new Date(m) : null);
        return findLatestDate(dates);
    }
}

customElements.define('ff-f', FakeFileFile);
customElements.define('ff-d', FakeFileDirectory);

export function joinArray<IN, OUT>(array: IN[], seperator: OUT | ((index: number, array: IN[]) => OUT), replacer?: ((v: IN, k: number) => OUT) | undefined, isCallback: boolean = false): OUT [] {
    const a = Array.from(array, replacer ?? (m => m as unknown as OUT)), result: OUT[] = [];
    let index = 0;
    for (const t of a) {
        if (isCallback) {
            result.push(t, Function.prototype.apply.call(
                seperator as ((index: number, array: IN[]) => OUT),
                result, [index++, a]));
        } else {
            result.push(t, seperator as OUT);
        }
    }
    if (result.length > 2)
        result.length = result.length - 1;
    return result;
}

export function uppercaseAfterHyphen(str: string): string {
    return String(str).split('').map((char, i, arr) => {
        if (i === 0 || arr[i - 1] === '-') {
            return char.toUpperCase();
        }
        return char;
    }).join('');
}

export const isValidDate = function (date: Date): boolean {
    return !isNaN(date as unknown as number);
};

export function findLatestDate<T>(array: T[], toDate: (object: T, index: number) => Date | null = m => m as Date | null): Date | null {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.max(...(dates.filter(m => m !== null) as Date[]).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate)) return asDate;
    else return null;
}

export function findFirstDate<T>(array: T[], toDate: (object: T, index: number) => Date | null = m => m as Date | null): Date | null {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.min(...(dates.filter(m => m !== null) as Date[]).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate)) return asDate;
    else return null;
}

