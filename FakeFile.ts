"use strict"; // FakeFilesUI
const {promise, resolve} = Promise.withResolvers<unknown>();
const colorRegExp = /^#?[a-f0-9]/i;

export class FakeFileUIElement extends HTMLElement {
    #_onDomInserted = Promise.withResolvers<void>()

    constructor() {
        super();
        Promise.all([promise, this.#_onDomInserted]).then(() => this?._whenAllFFElementsDefined());
    }

    // https://github.com/DNSCond/dnscond.github.io
    getFullPath(): string[] {
        let current: HTMLElement | null = this, result = [this.fileName || current.tagName];
        while ((current = current.parentElement) instanceof FakeFileUIElement) {
            result.push(current.fileName || current.tagName);
        }
        return result.reverse();
    }

    getPath(): string {
        return this.getFullPath().join('/');
    }

    set fileName(value: string | null) {
        if (value === null) this.removeAttribute('ff-name');
        else this.setAttribute('ff-name', value);
    }

    get fileName(): string | null {
        return this.getAttribute('ff-name');
    }

    connectedCallback(): void {
        this.#_onDomInserted.resolve();
    }

    _whenAllFFElementsDefined(): void {
    }

    get bytesize(): number {
        return NaN;
    }

    get bytesizeFormatted(): string {
        const {bytesize} = this;
        if (bytesize > 0)
            return cbyte(bytesize);
        return "NaN bytes";
    }

    /**
     * returns an invalid date, inherit from it please.
     */
    get lastMod(): Date | null {
        return new Date(NaN);
    }

    set backgroundColor(color: string | null) {
        if (color === null) {
            this.removeAttribute('fakefile-bgcolor');
        } else if (typeof (color as unknown) === "string" && colorRegExp.test(color)) {
            color = '#' + color.replace(/^#/, '');
            this.setAttribute('fakefile-bgcolor', color);
        } else
            throw new TypeError('color must be a color in the hex color format');
    }

    get backgroundColor(): string | null | undefined {
        const color = this.getAttribute('fakefile-bgcolor');
        if (color === null) return null; else {
            if (colorRegExp.test(color)) {
                return color;
            } else return undefined;
        }
    }
}

export type changes = { changeName: string, oldValue?: string | null | undefined, newValue: string | null };
export type HeadersetTSTypes = string | number | boolean | Date | null;

/**
 * about types:
 *
 * the default type is string, so it can be omitted.
 *
 * write a string like "key1=type1,key2=type2,key3=type3", case-insensitive,
 * whitespace ignored "key1 = type1, key2 = type2, key3 = type3".
 *
 * keys must be entered without the "headerset-*" prefix
 *
 * - isodatetime: write a isoString, formatted like Date.prototype.toISOString (or whatever you put in if its invalid)
 * - datetime-global: write a isoString, formatted like Date.prototype.toUTCString
 * - datetime-utc: alias to datetime-global
 * - datetime-local: write a isoString, formatted like Date.prototype.toString
 * - date: write a isoString, formatted like Date.prototype.toUTCString
 * - time: write a isoString, formatted like Date.prototype.toTimeString
 * - bytes: write a number representing bytes, then it formats for humans
 *
 * @param type one of the strings of the above list.
 * @param string the string to compute with.
 * @param keepType whether to convert that to a string.
 * @returns an object with `string` and `type`
 */
export function stringtoType(
    type: string | undefined, string: string | null,
    keepType: boolean = false): { string: HeadersetTSTypes, type: 'time' | 'string' | null, timeValue?: Date } {
    if (string === null) return {string: null, type: 'string'};
    const asIs = {string, type: 'string'} as const;
    if (type === undefined) return asIs;
    const timeValue = new Date(string),
        asTime = {
            string: timeValue,
            type: "time",
            timeValue,
        } as const;
    switch (type) {
        case "isodatetime":
            if (keepType) return asTime;
            if (isValidDate(timeValue)) {
                return {
                    string: timeValue.toISOString(),
                    type: "time", timeValue,
                };
            } else return asIs;
        case "datetime-utc":
        case "datetime-global":
            if (keepType) return asTime;
            return {
                string: timeValue.toUTCString(),
                type: "time", timeValue,
            };
        case "datetime-local":
            if (keepType) return asTime;
            return {
                string: timeValue.toString(),
                type: "time", timeValue,
            };
        case "date":
            if (keepType) return asTime;
            return {
                string: timeValue.toDateString(),
                type: "time", timeValue,
            };
        case "time":
            if (keepType) return asTime;
            return {
                string: timeValue.toTimeString(),
                type: "time", timeValue,
            };
        case "bytes":
            if (keepType) return {string: +string, type: "string"};
            return {string: cbyte(+string), type: "string"};
        default:
    }
    return asIs;
}

export class FakeFileFile extends FakeFileUIElement {
    #observer: MutationObserver = new MutationObserver(change => this.#attributeChangedCallback(change));
    #headerval: Map<string, string> = new Map;
    #abortController?: AbortController;
    #backgroundDefault = '#E7F4FD';/*#C9EAFF*/

    static get observedAttributes(): string[] {
        return ['ff-name', 'lastmod', 'open', 'bytesize', 'headerval', 'fakefile-bgcolor'];
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
        details.append(summary, head, div);//
        const bgc = Object.assign(
            document.createElement('style'), {
                innerText: `details{background-color:${this.#backgroundDefault}}`,
                className: "background-color",
            });
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {color:black;/* File */
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
        }), bgc, details);
    }

    override get backgroundColor() {
        return super.backgroundColor ?? this.#backgroundDefault;
    }

    override set backgroundColor(value) {
        super.backgroundColor = value;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.#abortController?.abort();
        const {signal} = (this.#abortController = new AbortController);
        const metadata = this.shadowRoot?.querySelector('.metadata');
        this.#observer.observe(this, {attributes: true, attributeOldValue: true});
        (this.shadowRoot!.querySelector('details') as HTMLDetailsElement)!.addEventListener(
            // @ts-ignore
            'toggle', (event: ToggleEvent) => {
                this.open = (event.newState === 'open')
            }, {signal});
        {
            const style = this.shadowRoot!.querySelector('style.background-color')! as HTMLStyleElement;
            style.innerText = `details{background-color:${this.backgroundColor}}`;
        }
        if (metadata) {
            metadata.replaceChildren();
            this.updateHeaders();
        }
    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
        this.#observer?.disconnect();
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
                case 'bytesize': {
                    if (newValue !== null) {
                        this.#recreateMetaData([{changeName: 'content-length', oldValue, newValue}]);
                    }
                    break;
                }
                case 'headerval':
                    this.#headerval = this.getHeaderValTypes() ?? new Map;
                    break;
                case "open": {
                    const details = this.shadowRoot.querySelector('details');
                    if (details) {
                        if (details.open !== (newValue !== null)) {
                            details.open = newValue !== null;
                        }
                    }
                    break;
                }
                case "fakefile-bgcolor": {
                    const style = this.shadowRoot.querySelector('style.background-color') as HTMLStyleElement | null;
                    if (style) {
                        if (newValue && colorRegExp.test(newValue)) {
                            style.innerText = `details{background-color:${newValue}}`;
                        } else {
                            style.innerText = `details{background-color:${this.#backgroundDefault}}`;
                        }
                    }
                }
                    break;
            }
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
                        newValue = (new Date(newValue)).toISOString();
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
        this.#recreateMetaData(changes);
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
                div.dataset["keyName"] = string;
                elements[string] = div;
            }
            const changesToMake: HTMLElement[] = [];
            for (const change of changes) {
                if (elements[change.changeName]) {
                    // const {keyElement, valElement} = elements[change.changeName];
                    const keyElement = elements[change.changeName]!.querySelector('dt') ?? undefined;
                    const valElement = elements[change.changeName]!.querySelector('dd') ?? undefined;
                    if (change.newValue === null) {
                        elements[change.changeName]?.remove();
                    }
                    if (keyElement === undefined || valElement === undefined) {
                        throw new TypeError('InternalError');
                    }
                    if (change.newValue) {
                        const span = this.#normalizeValueString(change.changeName, change.newValue);
                        valElement.replaceChildren(span);
                        keyElement.innerText = uppercaseAfterHyphen(change.changeName);
                        changesToMake.push(elements[change.changeName]!);
                    }
                }
            }
            metadata.append(...changesToMake);
        }
    }

    #normalizeValueString(name: string, value: string): HTMLSpanElement | HTMLTimeElement {
        switch (name) {
            case "content-length": {
                const self = this;
                return (function (value) {
                    if (!Number.isFinite(value)) {
                        const innerText = 'Invalid Number';
                        return Object.assign(self.ownerDocument.createElement('data'), {innerText, value});
                    }
                    const innerText = cbyte(value);
                    return Object.assign(self.ownerDocument.createElement('data'), {innerText, value});
                })(+value);
            }
            case "last-modified": {
                const d = new Date(value), dateTime = d.toISOString(), innerText = d.toUTCString();
                return Object.assign(this.ownerDocument.createElement('time'), {dateTime, innerText});
            }
        }
        const type = this.#headerval.get(name.toLowerCase().replace(/^headerset-/i, ''));
        // return stringtoType(type, value).string as string;
        const result = stringtoType(type, value);
        let span, innerText = result.string as string, dateTime = result.timeValue?.toISOString();
        if (result.type === "time")
            span = Object.assign(this.ownerDocument.createElement('time'), {dateTime, innerText});
        else span = Object.assign(this.ownerDocument.createElement('span'), {innerText});
        return span;
    }

    override set bytesize(value: number | null) {
        if (value === null) {
            this.removeAttribute('bytesize');
        } else if (Number.isSafeInteger(value)) {
            this.setAttribute('bytesize', String(value));
        } else throw RangeError(`${value} is not a valid bytesize=""`);
    }

    override get bytesize(): number {
        return +this.getAttribute('bytesize')!;
    }

    set open(value: boolean | string) {
        if (value || value === '') {
            this.setAttribute('open', value === true ? '' : value);
        } else {
            this.removeAttribute('open');
        }
    }

    get open(): boolean {
        return this.hasAttribute('open');
    }

    set headerVal(value: string | null) {
        if (value === null) this.removeAttribute('headerVal');
        else this.setAttribute('headerVal', value);
    }

    get headerVal(): string | null {
        return this.getAttribute('headerVal');
    }

    setHeaderValType(key: string, type: string, overwrite: boolean = false): this {
        return this.setHeaderValTypes((new Map).set(key, type), overwrite);
    }

    setHeaderValTypes(values: Map<string, string>, overwrite: boolean = false): this {
        const result = [], regexp = /^[a-z\-_0-9]+$/i;
        const array = [...this.#headerval];
        if (overwrite) array.length = 0;
        for (const [key, val] of array.concat([...values])) {
            if (regexp.test(key) || regexp.test(val)) {
                result.push(`${key}=${val}`);
            } // else {console.warn('warning setting: key =', key, '; val =', val);}
        }
        this.headerVal = result.join();
        return this;
    }

    getHeaderValTypes(): Map<string, string> | null {
        const temporary = this.headerVal?.replaceAll(/\s+/g, '');
        if (temporary === undefined) return null;
        const result: Map<string, string> = new Map;
        const types: { key: string | undefined, val: string | undefined }[] = temporary
            .toLowerCase().split(/,/g)
            .map(m => m.split(/=/g))
            .map(([key, val]) => ({key, val}));
        for (const {key, val} of types) {
            if (key === undefined || val === undefined)
                continue;
            result.set(key, val);
        }
        return result;
    }

    override set lastMod(value: Date | string | number | null) {
        if (value === null) {
            this.removeAttribute('lastmod');
        } else {
            const isoString = (new Date(value)).toISOString();
            this.setAttribute('lastmod', isoString);
        }
    }

    override get lastMod(): Date | null {
        const dt = this.getAttribute('lastmod');
        if (dt == null) return null;
        return new Date(dt);
    }

    setHeader(name: string, value: HeadersetTSTypes): this {
        name = `${name}`;
        const headersetName = `headerset-${name}`;
        if (value === null) {
            this.removeAttribute(headersetName);
            return this;
        }
        if (value instanceof Date) {
            value = value.toISOString();
            const overwrite = !this.getHeaderValTypes()?.get(name);
            if (overwrite) {
                this.setHeaderValType(name, 'datetime-global');
            }
        }
        this.setAttribute(headersetName, `${value}`);
        return this;
    }

    setHeaders(keyValues: Record<string, HeadersetTSTypes>): this {
        for (const [key, value] of (Object.entries(keyValues))) {
            this.setHeader(camelToKebab(key), value);
        }
        return this;
    }


    getHeader(name: string): HeadersetTSTypes {
        name = `${name}`;
        const headersetName = `headerset-${name}`;
        const value = this.getAttribute(headersetName);
        const type = this.#headerval.get(name)
        return stringtoType(type, value, true).string;
    }

    getAllHeaders(): Map<string, HeadersetTSTypes> {
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

    override _whenAllFFElementsDefined(): void {
    }
}

export class FakeFileDirectory extends FakeFileUIElement {
    #observer: MutationObserver = new MutationObserver(_change => this.#updateRegistered());
    #registered: FakeFileUIElement[] = [];
    #abortController?: AbortController;
    #backgroundDefault = '#FFE8BA';

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
        const bgc = Object.assign(
            document.createElement('style'), {
                innerText: `details{background-color:${this.#backgroundDefault}}`,
                className: "background-color",
            });
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {color:black;/* Directory */
                border: solid black 2px;
                border-right: none;
                padding: 0.5em;
            }li{margin-top:0.5em;
            margin-bottom:0.5em;}
            ul{margin-bottom:0;
            list-style-type:none;
            padding-left: 1ch;
            }`.replaceAll(/\s+/g, ' '),
        }), bgc, details);
    }

    override get backgroundColor() {
        return super.backgroundColor ?? this.#backgroundDefault;
    }

    override set backgroundColor(value) {
        super.backgroundColor = value;
    }

    override connectedCallback() {
        super.connectedCallback();
        this.#updateRegistered();
        const {signal} = (this.#abortController = new AbortController);
        this.#observer.observe(this, {childList: true});
        (this.shadowRoot!.querySelector('details') as HTMLDetailsElement)!.addEventListener(
            // @ts-ignore
            'toggle', (event: ToggleEvent) => {
                this.isexpanded = (event.newState === 'open');
            }, {signal});
        {
            const style = this.shadowRoot!.querySelector('style.background-color')! as HTMLStyleElement;
            style.innerText = `details{background-color:${this.backgroundColor}}`;
        }
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
                    if (details) {
                        if (details.open !== (newValue !== null)) {
                            details.open = newValue !== null;
                        }
                    }
                    break;
                }
                case "fakefile-bgcolor": {
                    const style = this.shadowRoot.querySelector('style.background-color') as HTMLStyleElement | null;
                    if (style) {
                        if (newValue && colorRegExp.test(newValue)) {
                            style.innerText = `details{background-color:${newValue}}`;
                        } else {
                            style.innerText = `details{background-color:${this.#backgroundDefault}}`;
                        }
                    }
                }
                    break;
            }
        }
    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
        this.#observer?.disconnect();
    }

    /**
     * Returns an up-to-date array of immediate child FakeFiles and Directories.
     */
    get childrenEntries(): FakeFileUIElement[] {
        return [...this.#registered];
    }

    #updateRegistered() {
        // only *direct* children (not nested descendants)
        // this.#registered = Array.from(this.children)
        // .filter((el): el is FakeFileFile | FakeFileDirectory =>
        // el instanceof FakeFileFile || el instanceof FakeFileDirectory);
        const children = (this.#registered = Array.from(this.children, child => {
            if (child instanceof FakeFileUIElement) {
                return child;
            } else {
                child.removeAttribute('slot');
                return null;
            }
        }).filter(m => m !== null) as FakeFileUIElement []);
        children.forEach(function (
            each, index) {
            const slotname = `FakeFile-${index++}`;
            each.setAttribute('slot', slotname);
        });
        this.#updateSlottedItems();
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

    set isexpanded(value: boolean | string) {
        if (value || value === '') {
            this.setAttribute('isexpanded', value === true ? '' : value);
        } else {
            this.removeAttribute('isexpanded');
        }
    }

    get isexpanded(): boolean {
        return this.hasAttribute('isexpanded');
    }

    get lastModified(): Date | null {
        return findLatestDate(this.childrenEntries.map(m => m.lastMod));
    }

    override get lastMod(): Date | null {
        return this.lastModified;
    }

    override get bytesize(): number {
        return this.childrenEntries.map(m => m.bytesize).reduce((prev, curr) => curr + prev, 0);
    }

    override _whenAllFFElementsDefined(): void {
        this.#updateRegistered();
    }
}

customElements.define('ff-d', FakeFileDirectory);
customElements.define('ff-f', FakeFileFile);
Promise.all([customElements.whenDefined('ff-d'), customElements.whenDefined('ff-f')]).then(resolve);

export function cbyte(bytesize: number): string {
    const units = Array("bytes", "KB", "MB", "GB", "TB");
    let i = 0;
    bytesize = +bytesize;
    if (!Number.isFinite(bytesize))
        throw new TypeError('bytesize resulted into a non finite number');
    while (bytesize >= 1024) {
        bytesize = bytesize / 1024;
        if (units[++i] === undefined) {
            i--;
            break
        }
    }
    return `${bytesize.toFixed(2).replace(/\.?0*$/, '')} ${units[i]}`;
}

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

export function uppercaseAfterHyphen(str: string): string {
    return String(str).split('').map((char, i, arr) => {
        if (i === 0 || arr[i - 1] === '-') return char.toUpperCase(); else return char;
    }).join('');
}

export function kebabToCamel(str: string): string {
    return String(str).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function camelToKebab(str: string): string {
    return String(str).replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-+/, '');
}
